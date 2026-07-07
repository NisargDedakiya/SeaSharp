import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { escrowAccounts, escrowMilestones, rfqs, shipments } from "@/db/schema";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { getSessionActor } from "@/core/identity/session";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { assertRfqTransition, assertSequentialAdvance } from "@/core/workflow/trade-workflow";
import { emit } from "@/core/events";

// Advances escrow to the next pending milestone. Funds only move at
// verified logistics milestones (spec section 05, Pillar B) — this endpoint
// is the only path that can progress an escrow, and it is gated to the two
// counterparties on the deal. Milestone update, shipment stage transitions,
// and the terminal RFQ/escrow status flip all happen inside one transaction.
export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const escrow = await serviceDb.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.id, params.id) });
  if (!escrow) {
    throw new AppError(404, "Escrow not found.");
  }

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, escrow.rfqId) });
  if (!rfq) throw new AppError(404, "RFQ not found.");
  const shipment = await serviceDb.query.shipments.findFirst({ where: eq(shipments.rfqId, rfq.id) });

  const isParticipant =
    rfq.organizationId === actor.organization.id ||
    shipment?.exporterOrganizationId === actor.organization.id;
  if (!isParticipant) {
    throw new AppError(403, "Not a participant on this trade.");
  }

  const milestones = await serviceDb.query.escrowMilestones.findMany({
    where: eq(escrowMilestones.escrowAccountId, escrow.id),
    orderBy: [asc(escrowMilestones.sequence)],
  });
  const nextMilestone = milestones.find((m) => m.status === "PENDING");
  if (!nextMilestone) {
    throw new AppError(409, "All milestones are already complete.");
  }
  const completedCount = milestones.filter((m) => m.status === "COMPLETE").length;
  assertSequentialAdvance(completedCount, nextMilestone.sequence + 1, "escrow milestone");

  const isFinalMilestone = nextMilestone.sequence === milestones.length - 1;
  const isDeliveryMilestone = nextMilestone.sequence === milestones.length - 2;
  const isCustomsMilestone = nextMilestone.sequence === milestones.length - 3;

  if (isFinalMilestone) {
    assertRfqTransition(rfq.status, "FULFILLED");
  }

  await serviceDb.transaction(async (tx) => {
    await tx
      .update(escrowMilestones)
      .set({ status: "COMPLETE", completedAt: new Date() })
      .where(eq(escrowMilestones.id, nextMilestone.id));

    await tx
      .update(escrowAccounts)
      .set(
        isFinalMilestone
          ? { status: "RELEASED", releasedAt: new Date() }
          : { status: "PARTIALLY_RELEASED" }
      )
      .where(eq(escrowAccounts.id, escrow.id));

    if (shipment && isCustomsMilestone) {
      await tx
        .update(shipments)
        .set({ transportStage: "CUSTOMS_CLEARANCE", customsClearedAt: new Date() })
        .where(eq(shipments.id, shipment.id));
    }

    if (shipment && isDeliveryMilestone) {
      await tx
        .update(shipments)
        .set({ transportStage: "DELIVERY", deliveredAt: new Date() })
        .where(eq(shipments.id, shipment.id));
    }

    if (shipment && isFinalMilestone) {
      await tx
        .update(shipments)
        .set({ transportStage: "COMPLETE", status: "COMPLETE" })
        .where(eq(shipments.id, shipment.id));

      await tx.update(rfqs).set({ status: "FULFILLED" }).where(eq(rfqs.id, rfq.id));
    }
  });

  if (isFinalMilestone && shipment) {
    await recalculateAndSaveSts(shipment.exporterOrganizationId);
  }

  const participantProfileIds = shipment
    ? [
        ...(await getOrganizationMemberProfileIds(rfq.organizationId)),
        ...(await getOrganizationMemberProfileIds(shipment.exporterOrganizationId)),
      ]
    : await getOrganizationMemberProfileIds(rfq.organizationId);

  await emit({
    type: "ESCROW_MILESTONE_RELEASED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      escrowId: escrow.id,
      milestoneName: nextMilestone.name,
      recipientProfileIds: participantProfileIds,
    },
  });

  if (isFinalMilestone) {
    await emit({
      type: "SHIPMENT_DELIVERED",
      organizationId: actor.organization.id,
      actorProfileId: actor.user.id,
      payload: { rfqId: rfq.id, escrowId: escrow.id, recipientProfileIds: participantProfileIds },
    });
  }

  const updatedEscrow = await serviceDb.query.escrowAccounts.findFirst({
    where: eq(escrowAccounts.id, escrow.id),
  });

  return NextResponse.json({ ...updatedEscrow, amount: Number(updatedEscrow!.amount) });
});
