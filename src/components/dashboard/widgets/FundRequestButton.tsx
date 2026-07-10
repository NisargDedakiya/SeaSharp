"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Commits this investor org's capital to one specific financing request
// (POST /api/investments/:id/fund) — the only interactive piece of
// InvestmentsWidget, which is otherwise a server component.
export function FundRequestButton({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFund() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investments/${loanId}/fund`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not fund this request.");
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
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleFund}
        disabled={loading}
        className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
      >
        {loading ? "Funding..." : "Fund"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
