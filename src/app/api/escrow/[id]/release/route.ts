import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Escrow, Rfq, Shipment } from "@/models";
import { recalculateAndSaveSts } from "@/lib/sts-server";
import { serialize } from "@/lib/serialize";

// Advances escrow to the next pending milestone. Funds only move at
// verified logistics milestones (spec section 05, Pillar B) — this endpoint
// is the only path that can progress an escrow, and it is gated to the two
// counterparties on the deal. Milestone update, shipment stage transitions,
// and the terminal RFQ/escrow status flip all happen inside one replica-set
// transaction.
export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AppError(401, "Sign in required.");
  }

  if (!mongoose.isValidObjectId(params.id)) {
    throw new AppError(404, "Escrow not found.");
  }

  const escrow = await Escrow.findById(params.id);
  if (!escrow) {
    throw new AppError(404, "Escrow not found.");
  }

  const rfq = await Rfq.findById(escrow.rfqId).orFail();
  const shipment = await Shipment.findOne({ rfqId: rfq._id });

  const isParticipant =
    rfq.importerId.toString() === session.user.id ||
    shipment?.exporterId.toString() === session.user.id;
  if (!isParticipant) {
    throw new AppError(403, "Not a participant on this trade.");
  }

  type Milestone = (typeof escrow.milestones)[number];
  const milestones = escrow.milestones.slice().sort((a: Milestone, b: Milestone) => a.sequence - b.sequence);
  const nextMilestone = milestones.find((m: Milestone) => m.status === "PENDING");
  if (!nextMilestone) {
    throw new AppError(409, "All milestones are already complete.");
  }

  const isFinalMilestone = nextMilestone.sequence === milestones.length - 1;
  const isDeliveryMilestone = nextMilestone.sequence === milestones.length - 2;
  const isCustomsMilestone = nextMilestone.sequence === milestones.length - 3;

  const mongooseSession = await mongoose.startSession();
  try {
    await mongooseSession.withTransaction(async () => {
      const target = escrow.milestones.id(nextMilestone._id);
      if (!target) throw new AppError(404, "Milestone not found.");
      target.status = "COMPLETE";
      target.completedAt = new Date();

      if (isFinalMilestone) {
        escrow.status = "RELEASED";
        escrow.releasedAt = new Date();
      } else {
        escrow.status = "PARTIALLY_RELEASED";
      }
      await escrow.save({ session: mongooseSession });

      if (shipment && isCustomsMilestone) {
        shipment.transportStage = "CUSTOMS_CLEARANCE";
        shipment.customsClearedAt = new Date();
        await shipment.save({ session: mongooseSession });
      }

      if (shipment && isDeliveryMilestone) {
        shipment.transportStage = "DELIVERY";
        shipment.deliveredAt = new Date();
        await shipment.save({ session: mongooseSession });
      }

      if (shipment && isFinalMilestone) {
        shipment.transportStage = "COMPLETE";
        shipment.status = "COMPLETE";
        await shipment.save({ session: mongooseSession });

        rfq.status = "FULFILLED";
        await rfq.save({ session: mongooseSession });
      }
    });
  } finally {
    await mongooseSession.endSession();
  }

  if (isFinalMilestone && shipment) {
    await recalculateAndSaveSts(shipment.exporterId.toString());
  }

  return NextResponse.json(serialize(escrow));
});
