import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { tradeLoans } from "@/db/schema";
import { scoreLoanRequest } from "@/core/ai/credit-ai";
import { getSessionActor } from "@/core/identity/session";
import { verifyFinancingCollateral } from "@/core/finance/loans";
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
    where: eq(tradeLoans.requestingOrganizationId, actor.organization.id),
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

// Trade finance request (spec Pillar D / E). Exporters request pre-shipment
// financing against a verified purchase order — funds to buy/produce goods
// before exporting them; importers request import-purchase financing
// against an RFQ they've had awarded — funds to import goods in order to
// resell them domestically. Both are scored identically by CreditLayer off
// the requesting org's STS and the deal's verified escrow value; an
// INVESTOR organization later funds the approved request (see POST
// /api/investments/:id/fund) rather than capital coming from a generic pool.
export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor || (actor.organization.type !== "EXPORTER" && actor.organization.type !== "IMPORTER")) {
    throw new AppError(403, "Only exporters and importers can request trade financing.");
  }

  const body = await request.json();
  const { rfqId, requestedAmount } = loanSchema.parse(body);

  const collateral = await verifyFinancingCollateral({
    rfqId,
    organizationId: actor.organization.id,
    organizationType: actor.organization.type,
  });
  if (!collateral) {
    throw new AppError(404, "No verified purchase order found for this organization on that RFQ.");
  }

  const decision = scoreLoanRequest({
    stsScore: actor.organization.stsScore,
    requestedAmount,
    poValue: collateral.escrowAmount,
  });

  const [loan] = await serviceDb
    .insert(tradeLoans)
    .values({
      requestingOrganizationId: actor.organization.id,
      requestingOrgType: actor.organization.type,
      rfqId,
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
