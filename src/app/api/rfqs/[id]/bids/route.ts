import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Rfq, Bid } from "@/models";
import { serialize } from "@/lib/serialize";

const bidSchema = z.object({
  pricePerUnit: z.coerce.number().positive(),
  message: z.string().max(1000).optional(),
});

// BidSense stub: a real model would rank historical winning bids by product,
// season, and volume. Until that training data exists, suggest a price just
// under the buyer's stated target — directionally useful, cheap to compute.
function suggestBidPrice(targetPricePerUnit: number) {
  return Math.round(targetPricePerUnit * 0.97 * 100) / 100;
}

export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "EXPORTER") {
    throw new AppError(403, "Only exporters can submit bids.");
  }

  if (!mongoose.isValidObjectId(params.id)) {
    throw new AppError(404, "RFQ not found.");
  }

  const rfq = await Rfq.findById(params.id);
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

  const aiSuggestedPrice = suggestBidPrice(rfq.targetPricePerUnit);

  const bid = await Bid.findOneAndUpdate(
    { rfqId: rfq._id, exporterId: session.user.id },
    { $set: { pricePerUnit, message }, $setOnInsert: { aiSuggestedPrice } },
    { upsert: true, returnDocument: "after" }
  );

  return NextResponse.json(serialize(bid), { status: 201 });
});
