import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Rfq, Bid, User, Escrow, Shipment } from "@/models";
import { ESCROW_MILESTONES, recommendRoute } from "@/lib/logistics";
import { serialize } from "@/lib/serialize";

const awardSchema = z.object({ bidId: z.string() });

// Importer awards a bid: locks funds in escrow, rejects the other bids, and
// spins up a Shipment record seeded with a RouteIQ freight recommendation.
// Escrow only ever releases through /api/escrow/[id]/release as milestones
// complete — no single actor can unilaterally move funds (spec section 09).
//
// All four writes (RFQ status, winning bid, rejected bids, escrow + embedded
// milestones, shipment) happen inside one replica-set transaction so a
// mid-operation failure can never leave the RFQ "AWARDED" without funded
// escrow, or vice versa.
export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AppError(401, "Sign in required.");
  }

  if (!mongoose.isValidObjectId(params.id)) {
    throw new AppError(404, "RFQ not found.");
  }

  const rfq = await Rfq.findById(params.id);
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }
  if (rfq.importerId.toString() !== session.user.id) {
    throw new AppError(403, "Only the RFQ owner can award a bid.");
  }
  if (rfq.status !== "OPEN") {
    throw new AppError(409, "This RFQ has already been awarded or closed.");
  }

  const body = await request.json();
  const { bidId } = awardSchema.parse(body);

  if (!mongoose.isValidObjectId(bidId)) {
    throw new AppError(404, "Bid not found on this RFQ.");
  }
  const winningBid = await Bid.findOne({ _id: bidId, rfqId: rfq._id });
  if (!winningBid) {
    throw new AppError(404, "Bid not found on this RFQ.");
  }

  const exporter = await User.findById(winningBid.exporterId).orFail();
  const escrowAmount = Math.round(winningBid.pricePerUnit * rfq.volume * 100) / 100;
  const route = recommendRoute({
    volume: rfq.volume,
    originLocation: rfq.originCountry,
    destinationLocation: rfq.destinationCountry,
  });

  const session_ = await mongoose.startSession();
  let escrow, shipment;
  try {
    await session_.withTransaction(async () => {
      rfq.status = "AWARDED";
      rfq.awardedBidId = winningBid._id;
      await rfq.save({ session: session_ });

      winningBid.status = "ACCEPTED";
      await winningBid.save({ session: session_ });

      await Bid.updateMany(
        { rfqId: rfq._id, _id: { $ne: winningBid._id } },
        { $set: { status: "REJECTED" } },
        { session: session_ }
      );

      const [createdEscrow] = await Escrow.create(
        [
          {
            rfqId: rfq._id,
            amount: escrowAmount,
            currency: rfq.currency,
            status: "FUNDED",
            fundedAt: new Date(),
            milestones: ESCROW_MILESTONES.map((name, index) => ({
              name,
              sequence: index,
              status: index === 0 ? "COMPLETE" : "PENDING",
              completedAt: index === 0 ? new Date() : null,
            })),
          },
        ],
        { session: session_ }
      );
      escrow = createdEscrow;

      const [createdShipment] = await Shipment.create(
        [
          {
            rfqId: rfq._id,
            exporterId: winningBid.exporterId,
            importerId: rfq.importerId,
            mode: route.mode,
            originLocation: rfq.originCountry,
            destinationLocation: rfq.destinationCountry,
            estimatedCost: route.estimatedCost,
            stsScoreAtTimeOfDeal: exporter.stsScore,
            aiRouteRecommendation: route.recommendation,
          },
        ],
        { session: session_ }
      );
      shipment = createdShipment;
    });
  } finally {
    await session_.endSession();
  }

  return NextResponse.json({ escrow: serialize(escrow), shipment: serialize(shipment) }, { status: 201 });
});
