import { STS_TIER_LABELS } from "@/core/finance/sts";
import type { StsBreakdown } from "@/core/finance/sts";
import { StsBadge } from "@/components/StsBadge";

// Lifted verbatim out of the old fixed dashboard/page.tsx exporter branch —
// wrapped as a widget rather than rewritten.
export function StsWidget({ breakdown }: { breakdown: StsBreakdown }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">SeaSharp Trust Score</h2>
        <StsBadge score={breakdown.totalScore} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm text-ink-400 sm:grid-cols-3">
        <dt>KYC/KYB</dt>
        <dd className="font-semibold text-gold-600">{breakdown.kycPoints}/200</dd>
        <dt className="sm:hidden" />
        <dt>On-Time Delivery</dt>
        <dd className="font-semibold text-gold-600">{breakdown.onTimeDeliveryPoints}/240</dd>
        <dt className="sm:hidden" />
        <dt>Escrow Speed</dt>
        <dd className="font-semibold text-gold-600">{breakdown.escrowSpeedPoints}/200</dd>
        <dt className="sm:hidden" />
        <dt>Dispute Rate</dt>
        <dd className="font-semibold text-gold-600">{breakdown.disputePoints}/200</dd>
        <dt className="sm:hidden" />
        <dt>Loan Repayment</dt>
        <dd className="font-semibold text-gold-600">{breakdown.loanRepaymentPoints}/160</dd>
      </dl>
      <p className="mt-3 text-xs text-ink-400">Tier: {STS_TIER_LABELS[breakdown.tier]}</p>
    </div>
  );
}
