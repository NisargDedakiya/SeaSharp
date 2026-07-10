import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { tradeLoans } from "@/db/schema";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { emit } from "@/core/events";

// An INVESTOR organization commits capital to one specific, already
// CreditLayer-approved financing request (see POST /api/loans) — mirrors
// how an importer awards one specific bid on an RFQ: a single actor picks
// a single counterparty, never an anonymous pool. Only ever transitions
// APPROVED + unfunded -> FUNDED; anything else (already funded, still
// under review, rejected, not found) is a 404 rather than leaking which
// case it was.
export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor || actor.organization.type !== "INVESTOR") {
    throw new AppError(403, "Only investors can fund financing requests.");
  }

  const [loan] = await serviceDb
    .update(tradeLoans)
    .set({ investorOrganizationId: actor.organization.id, status: "FUNDED", fundedAt: new Date() })
    .where(and(eq(tradeLoans.id, params.id), eq(tradeLoans.status, "APPROVED"), isNull(tradeLoans.investorOrganizationId)))
    .returning();

  if (!loan) {
    throw new AppError(404, "Open financing request not found (already funded, not approved, or doesn't exist).");
  }

  const borrowerProfileIds = await getOrganizationMemberProfileIds(loan.requestingOrganizationId);
  await emit({
    type: "LOAN_FUNDED",
    organizationId: loan.requestingOrganizationId,
    actorProfileId: actor.user.id,
    payload: {
      loanId: loan.id,
      investorOrganizationId: actor.organization.id,
      recipientProfileIds: borrowerProfileIds,
    },
  });

  return NextResponse.json({
    ...loan,
    requestedAmount: Number(loan.requestedAmount),
    approvedAmount: loan.approvedAmount ? Number(loan.approvedAmount) : null,
    interestRatePercent: loan.interestRatePercent ? Number(loan.interestRatePercent) : null,
  });
});
