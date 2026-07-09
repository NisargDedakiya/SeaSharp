import "server-only";
import { eq, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { shipments, escrowAccounts, tradeLoans } from "@/db/schema";
import type { CurrentOrganization } from "@/core/identity/session";

// Real numbers only, no projections: escrow volume across this exporter's
// awarded trades (escrow_accounts.amount, same join path
// dashboard/page.tsx used to compute LoanPanel's eligibleRfqs), plus
// STS-gated trade-finance volume actually approved for them
// (trade_loans.approvedAmount, set by scoreLoanRequest in
// src/app/api/loans/route.ts). Importers don't hold escrow/loans on their
// own organization row today, so this widget is exporter-only.
export async function RevenueWidget({ organization }: { organization: CurrentOrganization }) {
  const orgShipments = await serviceDb.query.shipments.findMany({
    where: eq(shipments.exporterOrganizationId, organization.id),
  });
  const rfqIds = orgShipments.map((s) => s.rfqId);
  const escrows = rfqIds.length
    ? await serviceDb.query.escrowAccounts.findMany({ where: inArray(escrowAccounts.rfqId, rfqIds) })
    : [];
  const escrowVolume = escrows.reduce((sum, e) => sum + Number(e.amount), 0);
  const releasedVolume = escrows
    .filter((e) => e.status === "RELEASED" || e.status === "PARTIALLY_RELEASED")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const loans = await serviceDb.query.tradeLoans.findMany({
    where: eq(tradeLoans.exporterOrganizationId, organization.id),
  });
  const stsLoanVolume = loans
    .filter((l) => l.approvedAmount)
    .reduce((sum, l) => sum + Number(l.approvedAmount), 0);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Revenue</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-400">Escrow volume</dt>
          <dd className="font-semibold text-gold-600">${escrowVolume.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-400">Released</dt>
          <dd className="font-semibold text-gold-600">${releasedVolume.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-400">STS-gated loan volume</dt>
          <dd className="font-semibold text-gold-600">${stsLoanVolume.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}
