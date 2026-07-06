import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Rfq, Bid, Escrow, Shipment } from "@/models";
import { serialize } from "@/lib/serialize";

// Blind bidding: the RFQ owner (importer) sees every bid to decide who to
// award. Exporters only ever see their own bid price plus the total bid
// count — never competitors' prices — so market pricing stays protected
// until the deal is done.
export const GET = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const session = await getServerSession(authOptions);

  if (!mongoose.isValidObjectId(params.id)) {
    throw new AppError(404, "RFQ not found.");
  }

  const rfq = await Rfq.findById(params.id).populate("importerId", "name companyName country");
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }

  const allBids = await Bid.find({ rfqId: rfq._id })
    .populate("exporterId", "name companyName stsScore")
    .sort({ createdAt: 1 });
  const escrow = await Escrow.findOne({ rfqId: rfq._id });
  const shipment = await Shipment.findOne({ rfqId: rfq._id });

  const isOwner = session?.user?.id === rfq.importerId._id.toString();
  const viewerId = session?.user?.id;

  const visibleBids = isOwner
    ? allBids
    : allBids.filter((bid) => bid.exporterId._id.toString() === viewerId);

  const { importerId, ...rfqRest } = serialize(rfq) as { importerId: unknown; [key: string]: unknown };
  const bids = (serialize(visibleBids) as Array<{ exporterId: unknown; [key: string]: unknown }>).map(
    ({ exporterId, ...bidRest }) => ({ ...bidRest, exporter: exporterId })
  );

  return NextResponse.json({
    ...rfqRest,
    importer: importerId,
    bids,
    escrow: serialize(escrow),
    shipment: serialize(shipment),
    totalBidCount: allBids.length,
  });
});
