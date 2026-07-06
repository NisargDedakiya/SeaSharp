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
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-100">
          Escrow · ${escrow.amount.toLocaleString()} {escrow.currency}
        </h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
          {escrow.status}
        </span>
      </div>

      {shipment && (
        <p className="mt-2 text-sm text-slate-500">
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
                  ? "bg-sky-500 text-slate-950"
                  : "border border-slate-600 text-slate-600"
              }`}
            >
              {m.status === "COMPLETE" ? "✓" : m.sequence + 1}
            </span>
            <span className={m.status === "COMPLETE" ? "text-slate-200" : "text-slate-500"}>
              {m.name}
            </span>
          </li>
        ))}
      </ol>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {canAdvance && nextMilestone && (
        <button
          onClick={handleAdvance}
          disabled={loading}
          className="mt-4 rounded-md bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {loading ? "Updating..." : `Mark "${nextMilestone.name}" Complete`}
        </button>
      )}
    </div>
  );
}
