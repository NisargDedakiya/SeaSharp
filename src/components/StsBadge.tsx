import { tierForScore, STS_TIER_LABELS } from "@/lib/sts";

const TIER_COLORS: Record<string, string> = {
  NEW: "bg-slate-700 text-slate-200",
  VERIFIED: "bg-sky-500/15 text-sky-400",
  RELIABLE: "bg-amber-500/15 text-amber-400",
  TRUSTED_PARTNER: "bg-emerald-500/15 text-emerald-400",
};

export function StsBadge({ score }: { score: number }) {
  const tier = tierForScore(score);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TIER_COLORS[tier]}`}>
      STS {score} · {STS_TIER_LABELS[tier]}
    </span>
  );
}
