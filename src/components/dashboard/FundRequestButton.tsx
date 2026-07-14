"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Investor-side commit action for one open funding request — POSTs to
// /api/funding-requests/[id]/fund, which enforces the INVESTOR /
// FINANCE_PARTNER gate and the OPEN-state race guard server-side.
export function FundRequestButton({ fundingRequestId }: { fundingRequestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFund() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/funding-requests/${fundingRequestId}/fund`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not fund this request.");
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
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleFund}
        disabled={loading}
        className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
      >
        {loading ? "Funding..." : "Fund"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
