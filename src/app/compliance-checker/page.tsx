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
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
        Free Tool · No Account Needed
      </p>
      <h1 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">Compliance Checker</h1>
      <p className="mt-3 max-w-2xl text-ink-500">
        Enter a product, origin, and destination to get an instant HS code, tariff estimate,
        landed cost, and document checklist.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 grid gap-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-premium sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm text-ink-700">Product</span>
          <input
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. cumin seeds"
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Origin Country</span>
          <select
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Destination Country</span>
          <select
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Product Value (USD)</span>
          <input
            type="number"
            min="0"
            value={productValue}
            onChange={(e) => setProductValue(e.target.value)}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-700">Estimated Freight (USD)</span>
          <input
            type="number"
            min="0"
            value={estimatedFreight}
            onChange={(e) => setEstimatedFreight(e.target.value)}
            className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-ink-900 px-6 py-2.5 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 sm:col-span-2"
        >
          {loading ? "Checking..." : "Check Compliance"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
            <h2 className="text-lg font-semibold text-gold-600">
              HS Code {result.hsCode.code}
            </h2>
            <p className="text-ink-700">{result.hsCode.description}</p>
            <p className="text-sm text-ink-500">{result.hsCode.category}</p>
          </div>

          {result.tariff ? (
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
              <h3 className="font-semibold text-ink-900">Tariff & Fees</h3>
              <p className="mt-2 text-sm text-ink-500">
                Duty: {result.tariff.tariffPercent}% · Additional fees:{" "}
                {result.tariff.additionalFeePercent}%
              </p>
              {result.tariff.notes && (
                <p className="mt-1 text-sm text-ink-400">{result.tariff.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              No tariff rule found for that origin/destination pair yet.
            </p>
          )}

          {result.landedCost && (
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
              <h3 className="font-semibold text-ink-900">Landed Cost Estimate</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-ink-500">
                <dt>Product value</dt>
                <dd className="text-right text-ink-700">${result.landedCost.productValue.toLocaleString()}</dd>
                <dt>Tariff amount</dt>
                <dd className="text-right text-ink-700">${result.landedCost.tariffAmount.toLocaleString()}</dd>
                <dt>Additional fees</dt>
                <dd className="text-right text-ink-700">${result.landedCost.additionalFeeAmount.toLocaleString()}</dd>
                <dt>Estimated freight</dt>
                <dd className="text-right text-ink-700">${result.landedCost.estimatedFreight.toLocaleString()}</dd>
                <dt className="font-semibold text-ink-900">Total landed cost</dt>
                <dd className="text-right font-semibold text-gold-600">
                  ${result.landedCost.landedCost.toLocaleString()}
                </dd>
              </dl>
            </div>
          )}

          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
            <h3 className="font-semibold text-ink-900">Document Checklist</h3>
            <ul className="mt-3 space-y-2">
              {result.documentChecklist.map((doc) => (
                <li key={doc.id} className="text-sm text-ink-500">
                  <span className="font-medium text-ink-700">{doc.name}</span> — {doc.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
