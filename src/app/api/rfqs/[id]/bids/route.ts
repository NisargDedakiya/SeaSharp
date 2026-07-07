import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { rfqs, bids } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { suggestBidPrice } from "@/core/ai/market-ai";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { emit } from "@/core/events";

const bidSchema = z.object({
  pricePerUnit: z.coerce.number().positive(),
  message: z.string().max(1000).optional(),
});

export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const actor = await getSessionActor();
  if (!actor || actor.organization.type !== "EXPORTER") {
    throw new AppError(403, "Only exporters can submit bids.");
  }

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, params.id) });
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }
  if (rfq.status !== "OPEN") {
    throw new AppError(409, "This RFQ is no longer accepting bids.");
  }
  if (new Date() > rfq.deadline) {
    throw new AppError(409, "The bidding deadline has passed.");
  }

  const body = await request.json();
  const { pricePerUnit, message } = bidSchema.parse(body);

  const aiSuggestedPrice = suggestBidPrice(Number(rfq.targetPricePerUnit));

  const existing = await serviceDb.query.bids.findFirst({
    where: and(eq(bids.rfqId, rfq.id), eq(bids.organizationId, actor.organization.id)),
  });

  const [bid] = existing
    ? await serviceDb
        .update(bids)
        .set({ pricePerUnit: pricePerUnit.toString(), message })
        .where(eq(bids.id, existing.id))
        .returning()
    : await serviceDb
        .insert(bids)
        .values({
          rfqId: rfq.id,
          organizationId: actor.organization.id,
          pricePerUnit: pricePerUnit.toString(),
          message,
          aiSuggestedPrice: aiSuggestedPrice.toString(),
        })
        .returning();

  const importerProfileIds = await getOrganizationMemberProfileIds(rfq.organizationId);
  await emit({
    type: "BID_SUBMITTED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      rfqId: rfq.id,
      bidId: bid.id,
      pricePerUnit: Number(bid.pricePerUnit),
      recipientProfileIds: importerProfileIds,
    },
  });

  return NextResponse.json(
    {
      id: bid.id,
      pricePerUnit: Number(bid.pricePerUnit),
      message: bid.message,
      aiSuggestedPrice: bid.aiSuggestedPrice ? Number(bid.aiSuggestedPrice) : null,
      status: bid.status,
    },
    { status: 201 }
  );
});
