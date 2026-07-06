"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { countryName } from "@/lib/countries";

export type RfqListItem = {
  id: string;
  product: string;
  volume: number;
  unit: string;
  originCountry: string;
  destinationCountry: string;
  targetPricePerUnit: number;
  deadline: string;
  createdAt: string;
  bidCount: number;
  importer: { name: string; companyName: string | null; kycStatus: string };
};

const SORTS = [
  { value: "newest", label: "Newest First" },
  { value: "closing", label: "Closing Soon" },
  { value: "bids", label: "Most Bids" },
  { value: "price", label: "Highest Target Price" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

function sortRfqs(rfqs: RfqListItem[], sort: SortValue): RfqListItem[] {
  const copy = [...rfqs];
  switch (sort) {
    case "closing":
      return copy.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    case "bids":
      return copy.sort((a, b) => b.bidCount - a.bidCount);
    case "price":
      return copy.sort((a, b) => b.targetPricePerUnit - a.targetPricePerUnit);
    case "newest":
    default:
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export function MarketplaceBrowser({ rfqs }: { rfqs: RfqListItem[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? rfqs.filter((rfq) => {
          const haystack = [
            rfq.product,
            countryName(rfq.originCountry),
            countryName(rfq.destinationCountry),
            rfq.importer.companyName ?? rfq.importer.name,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        })
      : rfqs;
    return sortRfqs(matches, sort);
  }, [rfqs, query, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product, origin, destination, or importer..."
            className="w-full rounded-md border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500/60 focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {filtered.length} of {rfqs.length} open RFQ{rfqs.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-500">
            No RFQs match &quot;{query}&quot;. Try a different search.
          </p>
        )}
        {filtered.map((rfq) => {
          const isNew = Date.now() - new Date(rfq.createdAt).getTime() < NEW_WINDOW_MS;
          const isVerified = rfq.importer.kycStatus === "VERIFIED";
          return (
            <Link
              key={rfq.id}
              href={`/marketplace/${rfq.id}`}
              className="group block rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-100">{rfq.product}</h2>
                  {isNew && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      New
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
                  {rfq.bidCount} bid{rfq.bidCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {rfq.volume.toLocaleString()} {rfq.unit} · {countryName(rfq.originCountry)} →{" "}
                {countryName(rfq.destinationCountry)} ·{" "}
                <span className="font-medium text-slate-200">
                  target ${rfq.targetPricePerUnit}/{rfq.unit}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>Posted by {rfq.importer.companyName ?? rfq.importer.name}</span>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Verified
                  </span>
                )}
                <span>· Bidding closes {new Date(rfq.deadline).toLocaleDateString()}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
