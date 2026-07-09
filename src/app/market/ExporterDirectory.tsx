"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { countryName } from "@/lib/countries";
import { tierForScore, STS_TIER_LABELS, type StsTier } from "@/core/finance/sts";
import { StsBadge } from "@/components/StsBadge";

export type ExporterListItem = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  kycStatus: string;
  stsScore: number;
  createdAt: string;
  completedShipments: number;
  distinctProducts: number;
  distinctDestinations: number;
  openBids: number;
};

const SORTS = [
  { value: "sts", label: "Highest STS Score" },
  { value: "track_record", label: "Most Completed Shipments" },
  { value: "newest", label: "Newest on SeaSharp" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

const TIER_OPTIONS: { value: StsTier | "ALL"; label: string }[] = [
  { value: "ALL", label: "Any tier" },
  { value: "TRUSTED_PARTNER", label: STS_TIER_LABELS.TRUSTED_PARTNER },
  { value: "RELIABLE", label: STS_TIER_LABELS.RELIABLE },
  { value: "VERIFIED", label: STS_TIER_LABELS.VERIFIED },
  { value: "NEW", label: STS_TIER_LABELS.NEW },
];

function sortExporters(items: ExporterListItem[], sort: SortValue): ExporterListItem[] {
  const copy = [...items];
  switch (sort) {
    case "track_record":
      return copy.sort((a, b) => b.completedShipments - a.completedShipments);
    case "newest":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "sts":
    default:
      return copy.sort((a, b) => b.stsScore - a.stsScore);
  }
}

export function ExporterDirectory({ exporters }: { exporters: ExporterListItem[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("ALL");
  const [tier, setTier] = useState<StsTier | "ALL">("ALL");
  const [kycOnly, setKycOnly] = useState(false);
  const [sort, setSort] = useState<SortValue>("sts");

  const countries = useMemo(() => {
    const set = new Set(exporters.map((e) => e.country).filter((c): c is string => Boolean(c)));
    return Array.from(set).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  }, [exporters]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let results = exporters;
    if (term) {
      results = results.filter((e) => {
        const haystack = [e.name, e.country ? countryName(e.country) : ""].join(" ").toLowerCase();
        return haystack.includes(term);
      });
    }
    if (country !== "ALL") {
      results = results.filter((e) => e.country === country);
    }
    if (tier !== "ALL") {
      results = results.filter((e) => tierForScore(e.stsScore) === tier);
    }
    if (kycOnly) {
      results = results.filter((e) => e.kycStatus === "VERIFIED");
    }
    return sortExporters(results, sort);
  }, [exporters, query, country, tier, kycOnly, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[220px] flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by exporter name or country..."
            className="w-full rounded-md border border-ink-100 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-md border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="ALL">Any country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {countryName(c)}
            </option>
          ))}
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as StsTier | "ALL")}
          className="rounded-md border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-md border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={kycOnly}
            onChange={(e) => setKycOnly(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
          />
          KYC-verified only
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          className="rounded-md border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-xs text-ink-400">
        {filtered.length} of {exporters.length} exporter{exporters.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-ink-100 bg-white p-6 text-center text-ink-500 shadow-premium">
            No exporters match your filters. Try broadening your search.
          </p>
        )}
        {filtered.map((exporter) => {
          const isVerified = exporter.kycStatus === "VERIFIED";
          const hasTrackRecord = exporter.completedShipments > 0;
          return (
            <div
              key={exporter.id}
              className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/60 hover:shadow-premium-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">{exporter.name}</h2>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {exporter.country ? countryName(exporter.country) : "Country not set"}
                  </p>
                </div>
                <StsBadge score={exporter.stsScore} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2 py-0.5 text-gold-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    KYC Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-500">KYC {exporter.kycStatus}</span>
                )}
                {exporter.openBids > 0 && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-500">
                    {exporter.openBids} active bid{exporter.openBids === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-ink-700">
                {hasTrackRecord ? (
                  <>
                    <span className="font-medium">{exporter.completedShipments}</span> completed shipment
                    {exporter.completedShipments === 1 ? "" : "s"} across{" "}
                    <span className="font-medium">{exporter.distinctProducts}</span> product
                    {exporter.distinctProducts === 1 ? "" : "s"} to{" "}
                    <span className="font-medium">{exporter.distinctDestinations}</span> destination
                    {exporter.distinctDestinations === 1 ? "" : "s"}
                  </>
                ) : (
                  <span className="text-ink-400">No completed shipments yet</span>
                )}
              </p>

              <div className="mt-4">
                <Link
                  href="/marketplace/new"
                  className="inline-flex rounded-md bg-ink-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-transform duration-200 hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98]"
                >
                  Post an Import Request
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
