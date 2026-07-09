"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Milestone = {
  id: string;
  name: string;
  sequence: number;
  status: string;
  completedAt: Date | string | null;
};

type Escrow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  milestones: Milestone[];
};

type Shipment = {
  mode: string;
  aiRouteRecommendation: string | null;
  estimatedCost: number;
} | null;

export function EscrowTracker({
  escrow,
  canAdvance,
  shipment,
}: {
  escrow: Escrow;
  canAdvance: boolean;
  shipment: Shipment;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextMilestone = escrow.milestones.find((m) => m.status === "PENDING");

  async function handleAdvance() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/escrow/${escrow.id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not advance milestone.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink-900">
          Escrow · ${escrow.amount.toLocaleString()} {escrow.currency}
        </h2>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {escrow.status}
        </span>
      </div>

      {shipment && (
        <p className="mt-2 text-sm text-ink-500">
          {shipment.mode} freight · est. cost ${shipment.estimatedCost.toLocaleString()}
          {shipment.aiRouteRecommendation ? ` — ${shipment.aiRouteRecommendation}` : ""}
        </p>
      )}

      <ol className="mt-4 space-y-2">
        {escrow.milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                m.status === "COMPLETE"
                  ? "bg-emerald-500 text-white"
                  : "border border-ink-100 text-ink-400"
              }`}
            >
              {m.status === "COMPLETE" ? "✓" : m.sequence + 1}
            </span>
            <span className={m.status === "COMPLETE" ? "text-ink-900" : "text-ink-500"}>
              {m.name}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}

      {canAdvance && nextMilestone && (
        <button
          onClick={handleAdvance}
          disabled={loading}
          className="mt-4 rounded-md bg-ink-900 px-5 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? "Updating..." : `Mark "${nextMilestone.name}" Complete`}
        </button>
      )}
    </div>
  );
}
