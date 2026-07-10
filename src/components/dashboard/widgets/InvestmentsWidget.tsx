import "server-only";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { tradeLoans, organizations, rfqs } from "@/db/schema";
import type { CurrentOrganization } from "@/core/identity/session";
import { FundRequestButton } from "./FundRequestButton";

// Investor-facing counterpart to LoanPanel's borrower-facing view: lists
// every open, CreditLayer-approved-but-unfunded financing request across
// the platform — an exporter's pre-shipment "buy to export" request or an
// importer's import-purchase "buy to resell" request (see POST
// /api/loans and its requestingOrgType) — plus this investor org's own
// funded portfolio. Real DB reads directly in the widget, same pattern
// RfqsWidget/RevenueWidget use for their org types.
export async function InvestmentsWidget({ organization }: { organization: CurrentOrganization }) {
  const openRequests = await serviceDb.query.tradeLoans.findMany({
    where: and(eq(tradeLoans.status, "APPROVED"), isNull(tradeLoans.investorOrganizationId)),
    orderBy: [desc(tradeLoans.requestedAt)],
    limit: 20,
  });
  const myFundedLoans = await serviceDb.query.tradeLoans.findMany({
    where: eq(tradeLoans.investorOrganizationId, organization.id),
    orderBy: [desc(tradeLoans.fundedAt)],
  });

  const allLoans = [...openRequests, ...myFundedLoans];
  const orgIds = Array.from(new Set(allLoans.map((l) => l.requestingOrganizationId)));
  const borrowerOrgs = orgIds.length
    ? await serviceDb.query.organizations.findMany({ where: inArray(organizations.id, orgIds) })
    : [];
  const orgNameById = new Map(borrowerOrgs.map((o) => [o.id, o.name]));

  const rfqIds = allLoans.filter((l) => l.rfqId).map((l) => l.rfqId!);
  const dealRfqs = rfqIds.length ? await serviceDb.query.rfqs.findMany({ where: inArray(rfqs.id, rfqIds) }) : [];
  const productByRfqId = new Map(dealRfqs.map((r) => [r.id, r.product]));

  function describeLoan(loan: (typeof allLoans)[number]) {
    const purpose = loan.requestingOrgType === "EXPORTER" ? "Export purchase" : "Import purchase";
    const product = loan.rfqId ? productByRfqId.get(loan.rfqId) : null;
    return `${orgNameById.get(loan.requestingOrganizationId) ?? "Unknown organization"} — ${purpose}${
      product ? ` · ${product}` : ""
    }`;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">Investment Opportunities</h2>

      {openRequests.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No open financing requests right now.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {openRequests.map((loan) => (
            <li key={loan.id} className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 last:border-0">
              <div>
                <p className="text-sm text-slate-200">{describeLoan(loan)}</p>
                <p className="text-sm text-slate-500">
                  ${Number(loan.approvedAmount ?? loan.requestedAmount).toLocaleString()} at{" "}
                  {loan.interestRatePercent}% · {loan.riskBand}
                </p>
              </div>
              <FundRequestButton loanId={loan.id} />
            </li>
          ))}
        </ul>
      )}

      {myFundedLoans.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-slate-300">My Funded Requests</h3>
          <ul className="mt-2 space-y-2">
            {myFundedLoans.map((loan) => (
              <li key={loan.id} className="text-sm text-slate-400">
                {describeLoan(loan)} — ${Number(loan.approvedAmount ?? loan.requestedAmount).toLocaleString()} at{" "}
                {loan.interestRatePercent}% · {loan.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
