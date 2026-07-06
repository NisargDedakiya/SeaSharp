import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Rfq, Escrow, Shipment, User, TradeLoan } from "@/models";
import { scoreLoanRequest } from "@/lib/creditlayer";
import { serialize } from "@/lib/serialize";

const loanSchema = z.object({
  rfqId: z.string(),
  requestedAmount: z.coerce.number().positive(),
});

export const GET = withApiHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AppError(401, "Sign in required.");
  }
  const loans = await TradeLoan.find({ exporterId: session.user.id }).sort({ requestedAt: -1 });
  return NextResponse.json(serialize(loans));
});

// PO-backed trade finance request (spec Pillar D). Only an exporter holding
// an awarded, escrow-funded RFQ (a "platform-verified purchase order") can
// request an advance against it, scored by CreditLayer off their STS.
export const POST = withApiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "EXPORTER") {
    throw new AppError(403, "Only exporters can request PO financing.");
  }

  const body = await request.json();
  const { rfqId, requestedAmount } = loanSchema.parse(body);

  const rfq = await Rfq.findById(rfqId);
  const escrow = rfq ? await Escrow.findOne({ rfqId: rfq._id }) : null;
  const shipment = rfq ? await Shipment.findOne({ rfqId: rfq._id }) : null;

  if (!rfq || !escrow || shipment?.exporterId.toString() !== session.user.id) {
    throw new AppError(404, "No verified purchase order found for this exporter on that RFQ.");
  }

  const exporter = await User.findById(session.user.id).orFail();
  const decision = scoreLoanRequest({
    stsScore: exporter.stsScore,
    requestedAmount,
    poValue: escrow.amount,
  });

  const loan = await TradeLoan.create({
    exporterId: session.user.id,
    rfqId: rfq._id,
    requestedAmount,
    approvedAmount: decision.approvedAmount,
    interestRatePercent: decision.interestRatePercent,
    riskBand: decision.riskBand,
    status: decision.approved ? "APPROVED" : "REJECTED",
  });

  return NextResponse.json({ loan: serialize(loan), decision }, { status: 201 });
});
