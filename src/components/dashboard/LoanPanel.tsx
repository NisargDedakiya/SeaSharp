"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EligibleRfq = { id: string; product: string; escrowAmount: number };
type Loan = {
  id: string;
  requestedAmount: number;
  approvedAmount: number | null;
  interestRatePercent: number | null;
  riskBand: string | null;
  status: string;
};

export function LoanPanel({
  eligibleRfqs,
  loans,
}: {
  eligibleRfqs: EligibleRfq[];
  loans: Loan[];
}) {
  const router = useRouter();
  const [rfqId, setRfqId] = useState(eligibleRfqs[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDecision(null);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfqId, requestedAmount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit request.");
        return;
      }
      setDecision(data.decision.reason);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">PO-Backed Trade Finance</h2>

      {eligibleRfqs.length > 0 ? (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-300">Verified purchase order</span>
            <select
              value={rfqId}
              onChange={(e) => setRfqId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {eligibleRfqs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.product} — PO value ${r.escrowAmount.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-300">Requested amount (USD)</span>
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {decision && <p className="text-sm text-emerald-400">{decision}</p>}
          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Request Financing"}
          </button>
        </form>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          No verified purchase orders yet. Win an RFQ to unlock PO financing.
        </p>
      )}

      {loans.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-slate-800 pt-4">
          {loans.map((loan) => (
            <li key={loan.id} className="text-sm text-slate-400">
              ${loan.requestedAmount.toLocaleString()} requested — {loan.status}
              {loan.approvedAmount != null &&
                ` · approved $${loan.approvedAmount.toLocaleString()} at ${loan.interestRatePercent}% (${loan.riskBand})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
