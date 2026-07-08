"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchEntityType, SearchResult } from "@/core/search/types";

// Command-palette style global search, wired into Navbar.tsx via Cmd/Ctrl+K.
// Groups results by entity type; only "hscodes" and "rfqs" return real
// matches today, other entity types in the union always come back empty
// (see src/core/search/stubs.ts) so the UI already renders correctly once
// they ship real data.
const ENTITY_LABELS: Record<SearchEntityType, string> = {
  hscodes: "HS Codes",
  rfqs: "RFQs",
  companies: "Companies",
  products: "Products",
  ports: "Ports",
  warehouses: "Warehouses",
  documents: "Documents",
};

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults({});
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const entries = await Promise.all(
          (["hscodes", "rfqs"] as const).map(async (type) => {
            const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(query)}`, {
              signal: controller.signal,
            });
            if (!res.ok) return [type, []] as const;
            const data = await res.json();
            return [type, data.results as SearchResult[]] as const;
          })
        );
        setResults(Object.fromEntries(entries.filter(([, r]) => r.length > 0)));
      } catch {
        // Aborted or transient network failure — leave prior results as-is.
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const groups = useMemo(() => Object.entries(results), [results]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-sky-500/60 hover:text-sky-300"
      >
        <span>Search</span>
        <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-500">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/95 shadow-[0_0_40px_-8px_rgba(56,189,248,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search HS codes, RFQs..."
          className="w-full rounded-t-2xl border-b border-slate-800 bg-transparent px-4 py-3 text-slate-50 placeholder:text-slate-500 focus:outline-none"
        />
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="px-2 py-2 text-sm text-slate-500">Searching...</p>}
          {!loading && query.trim() && groups.length === 0 && (
            <p className="px-2 py-2 text-sm text-slate-500">No results.</p>
          )}
          {groups.map(([type, items]) => (
            <div key={type} className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {ENTITY_LABELS[type as SearchEntityType]}
              </p>
              {items.map((item) => (
                <button
                  key={`${item.entityType}-${item.id}`}
                  onClick={() => {
                    setOpen(false);
                    if (item.url) router.push(item.url);
                  }}
                  className="flex w-full flex-col rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-800/60"
                >
                  <span className="text-sm text-slate-100">{item.title}</span>
                  {item.subtitle && <span className="text-xs text-slate-500">{item.subtitle}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
