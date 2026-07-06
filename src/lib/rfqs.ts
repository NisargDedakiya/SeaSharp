import "server-only";
import { Rfq, Bid } from "@/models";

// Shared by the /marketplace page (server component) and the /api/rfqs
// route so both list views stay in sync. Uses populate() + an in-memory bid
// count rather than an aggregation $lookup — simpler, and it keeps this
// codebase's Mongo usage to features with the widest compatibility across
// MongoDB-wire-protocol backends (some, like this repo's local FerretDB dev
// stand-in, don't implement $lookup).
export async function listOpenRfqs() {
  const rfqs = await Rfq.find({ status: "OPEN" })
    .sort({ createdAt: -1 })
    .populate("importerId", "name companyName country");

  const rfqIds = rfqs.map((rfq) => rfq._id);
  const bids = await Bid.find({ rfqId: { $in: rfqIds } }, { rfqId: 1 });
  const bidCountByRfqId = new Map<string, number>();
  for (const bid of bids) {
    const key = bid.rfqId.toString();
    bidCountByRfqId.set(key, (bidCountByRfqId.get(key) ?? 0) + 1);
  }

  return rfqs.map((rfq) => {
    const { importerId, ...rest } = rfq.toObject();
    return { ...rest, importer: importerId, bidCount: bidCountByRfqId.get(rfq._id.toString()) ?? 0 };
  });
}
