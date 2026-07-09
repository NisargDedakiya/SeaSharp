"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function KycPanel({ kycStatus }: { kycStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);

  async function handleSubmit() {
    setLoading(true);
    setFlags([]);
    try {
      const res = await fetch("/api/kyc", { method: "POST" });
      const data = await res.json();
      if (data.flags?.length) setFlags(data.flags);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (kycStatus === "VERIFIED") {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
        <h2 className="font-semibold text-ink-900">KYC / KYB</h2>
        <p className="mt-2 text-sm text-emerald-700">✓ Verified by SupplierRadar</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">KYC / KYB</h2>
      <p className="mt-2 text-sm text-ink-500">
        Status: {kycStatus}. Complete your company profile then submit for verification.
      </p>
      {flags.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-red-600">
          {flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-3 rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
      >
        {loading ? "Checking..." : "Submit for Verification"}
      </button>
    </div>
  );
}
