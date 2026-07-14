import "server-only";
import { listOpenFundingRequests } from "@/core/finance/funding";
import { StsBadge } from "@/components/StsBadge";
import { FundRequestButton } from "@/components/dashboard/FundRequestButton";

const KIND_LABELS: Record<string, string> = {
  LOAN: "Loan",
  ADVANCE: "Funds advance",
};

// The investor / finance-partner book of OPEN funding requests, each backed
// by an importer-confirmed deal (src/db/schema/marketplace.ts's `deals`).
// This replaced the former "coming soon" stub once funding_requests gave
// investors an unassigned/investable state to browse — see
// src/core/finance/funding.ts for the request/fund lifecycle.
export async function FundingOpportunitiesWidget() {
  const opportunities = await listOpenFundingRequests();

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Funding Opportunities</h2>

      {opportunities.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">
          No open funding requests right now. Exporters raise them against confirmed deals — new requests appear
          here automatically.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {opportunities.map((opportunity) => (
            <li key={opportunity.id} className="rounded-xl border border-ink-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-900">
                    {KIND_LABELS[opportunity.kind] ?? opportunity.kind} · ${" "}
                    {opportunity.requestedAmount.toLocaleString()} {opportunity.currency}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {opportunity.deal.product} — deal value ${opportunity.deal.totalValue.toLocaleString()} · importer{" "}
                    {opportunity.deal.importerName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    Exporter: {opportunity.exporter.name}
                    <StsBadge score={opportunity.exporter.stsScore} />
                    {opportunity.exporter.kycStatus === "VERIFIED" && (
                      <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-600">
                        KYC Verified
                      </span>
                    )}
                  </p>
                  {opportunity.note && <p className="mt-2 text-sm text-ink-700">&ldquo;{opportunity.note}&rdquo;</p>}
                </div>
                <FundRequestButton fundingRequestId={opportunity.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
