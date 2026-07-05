"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TnsBadge } from "@/components/TnsBadge";

type Bid = {
  id: string;
  pricePerUnit: number;
  message: string | null;
  status: string;
  exporter: { id: string; name: string; companyName: string | null; tnsScore: number };
};

export function BidList({
  rfqId,
  bids,
  rfqStatus,
  totalBidCount,
}: {
  rfqId: string;
  bids: Bid[];
  rfqStatus: string;
  totalBidCount: number;
}) {
  const router = useRouter();
  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAward(bidId: string) {
    setAwardingId(bidId);
    setError(null);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not award bid.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setAwardingId(null);
    }
  }

  const sorted = [...bids].sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">Bids ({totalBidCount})</h2>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No bids yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((bid) => (
            <li
              key={bid.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">
                    {bid.exporter.companyName ?? bid.exporter.name}
                  </span>
                  <TnsBadge score={bid.exporter.tnsScore} />
                </div>
                <p className="text-sm text-slate-400">
                  ${bid.pricePerUnit}/unit
                  {bid.message ? ` — "${bid.message}"` : ""}
                </p>
                <p className="text-xs text-slate-500">{bid.status}</p>
              </div>
              {rfqStatus === "OPEN" && (
                <button
                  onClick={() => handleAward(bid.id)}
                  disabled={awardingId === bid.id}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {awardingId === bid.id ? "Awarding..." : "Award"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
