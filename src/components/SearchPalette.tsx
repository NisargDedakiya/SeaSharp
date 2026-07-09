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
        className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-1.5 text-sm text-ink-500 transition-colors hover:border-gold-500/60 hover:text-gold-600"
      >
        <span>Search</span>
        <kbd className="rounded border border-ink-100 bg-cream-100 px-1.5 py-0.5 text-xs text-ink-400">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/60 px-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-ink-100 bg-white shadow-premium-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search HS codes, RFQs..."
          className="w-full rounded-t-2xl border-b border-ink-100 bg-transparent px-4 py-3 text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="px-2 py-2 text-sm text-ink-400">Searching...</p>}
          {!loading && query.trim() && groups.length === 0 && (
            <p className="px-2 py-2 text-sm text-ink-400">No results.</p>
          )}
          {groups.map(([type, items]) => (
            <div key={type} className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {ENTITY_LABELS[type as SearchEntityType]}
              </p>
              {items.map((item) => (
                <button
                  key={`${item.entityType}-${item.id}`}
                  onClick={() => {
                    setOpen(false);
                    if (item.url) router.push(item.url);
                  }}
                  className="flex w-full flex-col rounded-md px-2 py-2 text-left transition-colors hover:bg-cream-100"
                >
                  <span className="text-sm text-ink-900">{item.title}</span>
                  {item.subtitle && <span className="text-xs text-ink-400">{item.subtitle}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
