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
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-slate-100">KYC / KYB</h2>
        <p className="mt-2 text-sm text-sky-400">✓ Verified by SupplierRadar</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">KYC / KYB</h2>
      <p className="mt-2 text-sm text-slate-400">
        Status: {kycStatus}. Complete your company profile then submit for verification.
      </p>
      {flags.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-red-400">
          {flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-3 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
      >
        {loading ? "Checking..." : "Submit for Verification"}
      </button>
    </div>
  );
}
