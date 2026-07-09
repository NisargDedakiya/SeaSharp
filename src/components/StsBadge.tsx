import { tierForScore, STS_TIER_LABELS } from "@/core/finance/sts";

const TIER_COLORS: Record<string, string> = {
  NEW: "bg-ink-100 text-ink-700",
  VERIFIED: "bg-gold-500/15 text-gold-600",
  RELIABLE: "bg-amber-100 text-amber-700",
  TRUSTED_PARTNER: "bg-emerald-100 text-emerald-700",
};

export function StsBadge({ score }: { score: number }) {
  const tier = tierForScore(score);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TIER_COLORS[tier]}`}>
      STS {score} · {STS_TIER_LABELS[tier]}
    </span>
  );
}
