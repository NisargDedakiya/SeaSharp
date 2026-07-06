"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "CN", name: "China" },
];

type LookupResult = {
  hsCode: { code: string; description: string; category: string };
  alternateMatches: Array<{ code: string; description: string }>;
  tariff: { tariffPercent: number; additionalFeePercent: number; notes: string | null } | null;
  landedCost: {
    productValue: number;
    tariffAmount: number;
    additionalFeeAmount: number;
    estimatedFreight: number;
    landedCost: number;
  } | null;
  documentChecklist: Array<{ id: string; name: string; description: string }>;
};

export default function ComplianceCheckerPage() {
  const [product, setProduct] = useState("");
  const [originCountry, setOriginCountry] = useState("IN");
  const [destinationCountry, setDestinationCountry] = useState("AE");
  const [productValue, setProductValue] = useState("10000");
  const [estimatedFreight, setEstimatedFreight] = useState("500");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/compliance/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          originCountry,
          destinationCountry,
          productValue: Number(productValue),
          estimatedFreight: Number(estimatedFreight),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
        Free Tool · No Account Needed
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50 sm:text-4xl">Compliance Checker</h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Enter a product, origin, and destination to get an instant HS code, tariff estimate,
        landed cost, and document checklist.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 grid gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm text-slate-300">Product</span>
          <input
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. cumin seeds"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-600"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Origin Country</span>
          <select
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Destination Country</span>
          <select
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Product Value (USD)</span>
          <input
            type="number"
            min="0"
            value={productValue}
            onChange={(e) => setProductValue(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Estimated Freight (USD)</span>
          <input
            type="number"
            min="0"
            value={estimatedFreight}
            onChange={(e) => setEstimatedFreight(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 sm:col-span-2"
        >
          {loading ? "Checking..." : "Check Compliance"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-sky-400">
              HS Code {result.hsCode.code}
            </h2>
            <p className="text-slate-300">{result.hsCode.description}</p>
            <p className="text-sm text-slate-500">{result.hsCode.category}</p>
          </div>

          {result.tariff ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="font-semibold text-slate-100">Tariff & Fees</h3>
              <p className="mt-2 text-sm text-slate-400">
                Duty: {result.tariff.tariffPercent}% · Additional fees:{" "}
                {result.tariff.additionalFeePercent}%
              </p>
              {result.tariff.notes && (
                <p className="mt-1 text-sm text-slate-500">{result.tariff.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No tariff rule found for that origin/destination pair yet.
            </p>
          )}

          {result.landedCost && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="font-semibold text-slate-100">Landed Cost Estimate</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-400">
                <dt>Product value</dt>
                <dd className="text-right text-slate-200">${result.landedCost.productValue.toLocaleString()}</dd>
                <dt>Tariff amount</dt>
                <dd className="text-right text-slate-200">${result.landedCost.tariffAmount.toLocaleString()}</dd>
                <dt>Additional fees</dt>
                <dd className="text-right text-slate-200">${result.landedCost.additionalFeeAmount.toLocaleString()}</dd>
                <dt>Estimated freight</dt>
                <dd className="text-right text-slate-200">${result.landedCost.estimatedFreight.toLocaleString()}</dd>
                <dt className="font-semibold text-slate-200">Total landed cost</dt>
                <dd className="text-right font-semibold text-sky-400">
                  ${result.landedCost.landedCost.toLocaleString()}
                </dd>
              </dl>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="font-semibold text-slate-100">Document Checklist</h3>
            <ul className="mt-3 space-y-2">
              {result.documentChecklist.map((doc) => (
                <li key={doc.id} className="text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{doc.name}</span> — {doc.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
