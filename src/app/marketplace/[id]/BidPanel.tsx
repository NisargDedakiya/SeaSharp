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
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">
        {existingBid ? "Update Your Bid" : "Submit a Blind Bid"}
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Bids are blind — other exporters can&apos;t see your price.
      </p>

      {existingBid?.aiSuggestedPrice && (
        <p className="mt-3 rounded-md bg-gold-500/10 px-3 py-2 text-sm text-gold-600">
          BidSense suggests ${existingBid.aiSuggestedPrice}/{unit} to stay competitive.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Your price per {unit} (USD)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Message (optional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </label>
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-md bg-ink-900 px-5 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? "Submitting..." : existingBid ? "Update Bid" : "Submit Bid"}
        </button>
      </form>
    </div>
  );
}
