import type { SearchResult, StubbedSearchEntityType } from "./types";

// Companies: no public company-directory schema/data yet — see
// docs/02-product-requirements.md §3.4 (Supplier/Buyer Discovery), planned
// but unbuilt. Stub keeps the API surface stable for when it ships.
// Products, Ports, Warehouses: schema tables exist (src/db/schema/trade.ts)
// but hold no real, user-facing searchable content yet (products/warehouses
// are org-scoped with near-zero seeded rows; ports is static reference data
// not yet exposed as a search target anywhere in the product). Documents:
// src/db/schema/files.ts has a `documents` table but no full-text index or
// search UX has been designed for it yet.
export async function searchStub(entityType: StubbedSearchEntityType): Promise<SearchResult[]> {
  void entityType;
  return [];
}
