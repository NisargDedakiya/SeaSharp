"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ConfirmedDeal = {
  totalValue: number;
  currency: string;
  status: string;
  exporterName: string;
  confirmedAt: Date | string;
} | null;

// Shown to the RFQ-owning importer once a bid is awarded: one explicit
// action that confirms the deal with the winning exporter. After
// confirmation it renders the deal summary instead — the exporter's
// dashboard picks the deal up from the same table (see /api/deals).
export function ConfirmDealPanel({
  rfqId,
  exporterName,
  dealValue,
  currency,
  deal,
}: {
  rfqId: string;
  exporterName: string;
  dealValue: number;
  currency: string;
  deal: ConfirmedDeal;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfqId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not confirm the deal.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (deal) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-premium">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink-900">Deal confirmed with {deal.exporterName}</h2>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
            {deal.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-700">
          Deal value ${deal.totalValue.toLocaleString()} {deal.currency} · confirmed{" "}
          {new Date(deal.confirmedAt).toLocaleDateString()}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          The exporter now sees this deal on their dashboard and can raise investor financing against it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Confirm this deal</h2>
      <p className="mt-2 text-sm text-ink-500">
        Confirm the awarded trade with <span className="font-medium text-ink-700">{exporterName}</span> for $
        {dealValue.toLocaleString()} {currency}. Confirmation lists the deal on the exporter&apos;s dashboard
        and lets them request financing from investors against it.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="mt-4 rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
      >
        {loading ? "Confirming..." : "Confirm Deal"}
      </button>
    </div>
  );
}
