"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type DealPanelItem = {
  id: string;
  rfqId: string;
  product: string;
  totalValue: number;
  currency: string;
  status: string;
  confirmedAt: Date | string;
  counterpartyName: string;
  fundingRequest: {
    id: string;
    kind: string;
    requestedAmount: number;
    status: string;
  } | null;
};

const KIND_LABELS: Record<string, string> = {
  LOAN: "Loan",
  ADVANCE: "Funds advance",
};

// Confirmed deals list for the dashboard. Importers see a read-only list of
// the deals they confirmed; exporters additionally get the "request
// funding" flow per deal, which raises an investor-directed ask via
// /api/funding-requests (shown to INVESTOR / FINANCE_PARTNER orgs in their
// Funding Opportunities widget).
export function DealsPanel({ deals, canRequestFunding }: { deals: DealPanelItem[]; canRequestFunding: boolean }) {
  const router = useRouter();
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [kind, setKind] = useState("LOAN");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openForm(dealId: string) {
    setOpenDealId(dealId);
    setKind("LOAN");
    setAmount("");
    setNote("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openDealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/funding-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: openDealId,
          kind,
          requestedAmount: Number(amount),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit request.");
        return;
      }
      setOpenDealId(null);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Confirmed Deals</h2>

      {deals.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">
          {canRequestFunding
            ? "No confirmed deals yet. Once an importer confirms an awarded RFQ with you, it appears here and unlocks investor financing."
            : "No confirmed deals yet. Award a bid and confirm the deal from the RFQ page."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {deals.map((deal) => (
            <li key={deal.id} className="rounded-xl border border-ink-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <a href={`/marketplace/${deal.rfqId}`} className="font-medium text-ink-900 hover:underline">
                    {deal.product}
                  </a>
                  <p className="text-xs text-ink-500">
                    with {deal.counterpartyName} · ${deal.totalValue.toLocaleString()} {deal.currency} · confirmed{" "}
                    {new Date(deal.confirmedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {deal.status}
                </span>
              </div>

              {deal.fundingRequest ? (
                <p className="mt-3 text-sm text-ink-500">
                  {KIND_LABELS[deal.fundingRequest.kind] ?? deal.fundingRequest.kind} request — $
                  {deal.fundingRequest.requestedAmount.toLocaleString()} ·{" "}
                  <span
                    className={
                      deal.fundingRequest.status === "FUNDED" ? "font-medium text-emerald-700" : "text-amber-700"
                    }
                  >
                    {deal.fundingRequest.status === "OPEN" ? "awaiting investor" : deal.fundingRequest.status}
                  </span>
                </p>
              ) : canRequestFunding && deal.status === "CONFIRMED" ? (
                openDealId === deal.id ? (
                  <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 border-t border-ink-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="flex flex-1 flex-col gap-1">
                        <span className="text-xs text-ink-700">Type</span>
                        <select
                          value={kind}
                          onChange={(e) => setKind(e.target.value)}
                          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
                        >
                          <option value="LOAN">Loan</option>
                          <option value="ADVANCE">Funds advance</option>
                        </select>
                      </label>
                      <label className="flex flex-1 flex-col gap-1">
                        <span className="text-xs text-ink-700">Amount (max ${deal.totalValue.toLocaleString()})</span>
                        <input
                          type="number"
                          min="1"
                          max={deal.totalValue}
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-ink-700">Note to investors (optional)</span>
                      <input
                        type="text"
                        maxLength={1000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="rounded-md border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        {loading ? "Submitting..." : "Submit to investors"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenDealId(null)}
                        className="rounded-md border border-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => openForm(deal.id)}
                    className="mt-3 rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    Request loan / funds from investors
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
