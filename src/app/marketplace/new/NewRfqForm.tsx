"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type HsCode = { code: string; description: string; category: string };

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "CN", name: "China" },
];

export function NewRfqForm() {
  const router = useRouter();
  const [hsCodes, setHsCodes] = useState<HsCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    product: "",
    hsCode: "",
    originCountry: "IN",
    destinationCountry: "AE",
    volume: "1000",
    unit: "kg",
    targetPricePerUnit: "5",
    currency: "USD",
    deadline: "",
  });

  useEffect(() => {
    fetch("/api/hscodes")
      .then((res) => res.json())
      .then((data: HsCode[]) => {
        setHsCodes(data);
        if (data[0]) setForm((f) => ({ ...f, hsCode: data[0].code, product: data[0].description }));
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not post RFQ.");
        return;
      }
      router.push(`/marketplace/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const minDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-300">HS Code / Product</span>
        <select
          value={form.hsCode}
          onChange={(e) => {
            const hs = hsCodes.find((h) => h.code === e.target.value);
            setForm((f) => ({ ...f, hsCode: e.target.value, product: hs?.description ?? f.product }));
          }}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        >
          {hsCodes.map((hs) => (
            <option key={hs.code} value={hs.code}>
              {hs.code} — {hs.description}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Origin</span>
          <select
            value={form.originCountry}
            onChange={(e) => setForm((f) => ({ ...f, originCountry: e.target.value }))}
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
          <span className="text-sm text-slate-300">Destination</span>
          <select
            value={form.destinationCountry}
            onChange={(e) => setForm((f) => ({ ...f, destinationCountry: e.target.value }))}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Volume</span>
          <input
            type="number"
            min="1"
            value={form.volume}
            onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Unit</span>
          <input
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-300">Target Price per Unit (USD)</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={form.targetPricePerUnit}
          onChange={(e) => setForm((f) => ({ ...f, targetPricePerUnit: e.target.value }))}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-300">Bidding Deadline</span>
        <input
          type="datetime-local"
          required
          min={minDeadline}
          value={form.deadline}
          onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? "Posting..." : "Post RFQ"}
      </button>
    </form>
  );
}
