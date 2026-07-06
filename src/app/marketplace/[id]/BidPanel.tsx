"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ExistingBid = {
  pricePerUnit: number;
  message: string | null;
  aiSuggestedPrice: number | null;
  status: string;
} | null;

export function BidPanel({
  rfqId,
  targetPricePerUnit,
  unit,
  existingBid,
}: {
  rfqId: string;
  targetPricePerUnit: number;
  unit: string;
  existingBid: ExistingBid;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(String(existingBid?.pricePerUnit ?? targetPricePerUnit));
  const [message, setMessage] = useState(existingBid?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rfqs/${rfqId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerUnit: Number(price), message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit bid.");
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
      <h2 className="font-semibold text-slate-100">
        {existingBid ? "Update Your Bid" : "Submit a Blind Bid"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Bids are blind — other exporters can&apos;t see your price.
      </p>

      {existingBid?.aiSuggestedPrice && (
        <p className="mt-3 rounded-md bg-sky-500/10 px-3 py-2 text-sm text-sky-400">
          BidSense suggests ${existingBid.aiSuggestedPrice}/{unit} to stay competitive.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Your price per {unit} (USD)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Message (optional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-md bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {loading ? "Submitting..." : existingBid ? "Update Bid" : "Submit Bid"}
        </button>
      </form>
    </div>
  );
}
