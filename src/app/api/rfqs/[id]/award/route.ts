import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { rfqs, bids, organizations, escrowAccounts, escrowMilestones, shipments } from "@/db/schema";
import { ESCROW_MILESTONES } from "@/core/finance/escrow";
import { getRouteRecommendation } from "@/core/logistics";
import { getSessionActor } from "@/core/identity/session";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { assertRfqTransition } from "@/core/workflow/trade-workflow";
import { emit } from "@/core/events";

const awardSchema = z.object({ bidId: z.string() });

// Importer awards a bid: locks funds in escrow, rejects the other bids, and
// spins up a Shipment record seeded with a RouteIQ freight recommendation.
// Escrow only ever releases through /api/escrow/[id]/release as milestones
// complete — no single actor can unilaterally move funds (spec section 09).
//
// All writes happen inside one Postgres transaction so a mid-operation
// failure can never leave the RFQ "AWARDED" without funded escrow, or vice
// versa — mirrors the Phase 1 Mongoose replica-set transaction exactly.
export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, params.id) });
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }
  if (rfq.organizationId !== actor.organization.id) {
    throw new AppError(403, "Only the RFQ owner can award a bid.");
  }
  assertRfqTransition(rfq.status, "AWARDED");

  const body = await request.json();
  const { bidId } = awardSchema.parse(body);

  const winningBid = await serviceDb.query.bids.findFirst({
    where: and(eq(bids.id, bidId), eq(bids.rfqId, rfq.id)),
  });
  if (!winningBid) {
    throw new AppError(404, "Bid not found on this RFQ.");
  }

  const exporter = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, winningBid.organizationId),
  });
  if (!exporter) throw new AppError(404, "Exporter organization not found.");

  const escrowAmount = Math.round(Number(winningBid.pricePerUnit) * Number(rfq.volume) * 100) / 100;
  const route = getRouteRecommendation({
    volume: Number(rfq.volume),
    originLocation: rfq.originCountry,
    destinationLocation: rfq.destinationCountry,
  });

  const { escrow, shipment } = await serviceDb.transaction(async (tx) => {
    await tx.update(rfqs).set({ status: "AWARDED", awardedBidId: winningBid.id }).where(eq(rfqs.id, rfq.id));

    await tx.update(bids).set({ status: "ACCEPTED" }).where(eq(bids.id, winningBid.id));
    await tx
      .update(bids)
      .set({ status: "REJECTED" })
      .where(and(eq(bids.rfqId, rfq.id), ne(bids.id, winningBid.id)));

    const [createdEscrow] = await tx
      .insert(escrowAccounts)
      .values({
        rfqId: rfq.id,
        amount: escrowAmount.toString(),
        currency: rfq.currency,
        status: "FUNDED",
        fundedAt: new Date(),
      })
      .returning();

    await tx.insert(escrowMilestones).values(
      ESCROW_MILESTONES.map((name, index) => ({
        escrowAccountId: createdEscrow.id,
        name,
        sequence: index,
        status: index === 0 ? ("COMPLETE" as const) : ("PENDING" as const),
        completedAt: index === 0 ? new Date() : null,
      }))
    );

    const [createdShipment] = await tx
      .insert(shipments)
      .values({
        rfqId: rfq.id,
        exporterOrganizationId: winningBid.organizationId,
        importerOrganizationId: rfq.organizationId,
        mode: route.mode,
        originLocation: rfq.originCountry,
        destinationLocation: rfq.destinationCountry,
        estimatedCost: route.estimatedCost.toString(),
        stsScoreAtTimeOfDeal: exporter.stsScore.toString(),
        aiRouteRecommendation: route.recommendation,
      })
      .returning();

    return { escrow: createdEscrow, shipment: createdShipment };
  });

  const exporterProfileIds = await getOrganizationMemberProfileIds(winningBid.organizationId);
  await emit({
    type: "RFQ_AWARDED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      rfqId: rfq.id,
      bidId: winningBid.id,
      escrowId: escrow.id,
      recipientProfileIds: exporterProfileIds,
    },
  });

  return NextResponse.json(
    {
      escrow: { ...escrow, amount: Number(escrow.amount) },
      shipment: { ...shipment, estimatedCost: Number(shipment.estimatedCost) },
    },
    { status: 201 }
  );
});
