import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { rfqs, escrowAccounts, shipments, tradeLoans } from "@/db/schema";
import { scoreLoanRequest } from "@/core/ai/credit-ai";
import { getSessionActor } from "@/core/identity/session";
import { emit } from "@/core/events";

const loanSchema = z.object({
  rfqId: z.string(),
  requestedAmount: z.coerce.number().positive(),
});

export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }
  const loans = await serviceDb.query.tradeLoans.findMany({
    where: eq(tradeLoans.exporterOrganizationId, actor.organization.id),
    orderBy: [desc(tradeLoans.requestedAt)],
  });
  return NextResponse.json(
    loans.map((l) => ({
      ...l,
      requestedAmount: Number(l.requestedAmount),
      approvedAmount: l.approvedAmount ? Number(l.approvedAmount) : null,
      interestRatePercent: l.interestRatePercent ? Number(l.interestRatePercent) : null,
    }))
  );
});

// PO-backed trade finance request (spec Pillar D). Only an exporter holding
// an awarded, escrow-funded RFQ (a "platform-verified purchase order") can
// request an advance against it, scored by CreditLayer off their STS.
export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor || actor.organization.type !== "EXPORTER") {
    throw new AppError(403, "Only exporters can request PO financing.");
  }

  const body = await request.json();
  const { rfqId, requestedAmount } = loanSchema.parse(body);

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  const escrow = rfq ? await serviceDb.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.rfqId, rfq.id) }) : null;
  const shipment = rfq ? await serviceDb.query.shipments.findFirst({ where: eq(shipments.rfqId, rfq.id) }) : null;

  if (!rfq || !escrow || shipment?.exporterOrganizationId !== actor.organization.id) {
    throw new AppError(404, "No verified purchase order found for this exporter on that RFQ.");
  }

  const decision = scoreLoanRequest({
    stsScore: actor.organization.stsScore,
    requestedAmount,
    poValue: Number(escrow.amount),
  });

  const [loan] = await serviceDb
    .insert(tradeLoans)
    .values({
      exporterOrganizationId: actor.organization.id,
      rfqId: rfq.id,
      requestedAmount: requestedAmount.toString(),
      approvedAmount: decision.approvedAmount?.toString(),
      interestRatePercent: decision.interestRatePercent?.toString(),
      riskBand: decision.riskBand,
      status: decision.approved ? "APPROVED" : "REJECTED",
    })
    .returning();

  await emit({
    type: "LOAN_DECIDED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      loanId: loan.id,
      approved: decision.approved,
      recipientProfileIds: [actor.user.id],
    },
  });

  return NextResponse.json(
    {
      loan: {
        ...loan,
        requestedAmount: Number(loan.requestedAmount),
        approvedAmount: loan.approvedAmount ? Number(loan.approvedAmount) : null,
        interestRatePercent: loan.interestRatePercent ? Number(loan.interestRatePercent) : null,
      },
      decision,
    },
    { status: 201 }
  );
});
