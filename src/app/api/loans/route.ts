import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreLoanRequest } from "@/lib/creditlayer";

const loanSchema = z.object({
  rfqId: z.string(),
  requestedAmount: z.coerce.number().positive(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const loans = await prisma.tradeLoan.findMany({
    where: { exporterId: session.user.id },
    orderBy: { requestedAt: "desc" },
  });
  return NextResponse.json(loans);
}

// PO-backed trade finance request (spec Pillar D). Only an exporter holding
// an awarded, escrow-funded RFQ (a "platform-verified purchase order") can
// request an advance against it, scored by CreditLayer off their TNS.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "EXPORTER") {
    return NextResponse.json({ error: "Only exporters can request PO financing." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = loanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rfq = await prisma.rfq.findUnique({
    where: { id: parsed.data.rfqId },
    include: { escrow: true, shipment: true },
  });
  if (!rfq || !rfq.escrow || rfq.shipment?.exporterId !== session.user.id) {
    return NextResponse.json(
      { error: "No verified purchase order found for this exporter on that RFQ." },
      { status: 404 }
    );
  }

  const exporter = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const decision = scoreLoanRequest({
    tnsScore: exporter.tnsScore,
    requestedAmount: parsed.data.requestedAmount,
    poValue: rfq.escrow.amount,
  });

  const loan = await prisma.tradeLoan.create({
    data: {
      exporterId: session.user.id,
      rfqId: rfq.id,
      requestedAmount: parsed.data.requestedAmount,
      approvedAmount: decision.approvedAmount,
      interestRatePercent: decision.interestRatePercent,
      riskBand: decision.riskBand,
      status: decision.approved ? "APPROVED" : "REJECTED",
    },
  });

  return NextResponse.json({ loan, decision }, { status: 201 });
}
