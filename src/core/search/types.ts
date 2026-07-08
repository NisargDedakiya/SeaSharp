// Shared types for the search layer. Keep this stable — Task 5's dashboard
// widget and Task 6's public API surface both consume `SearchResult` and the
// `SearchEntityType` union directly.

// Entity types with a real, queryable implementation today.
export const REAL_SEARCH_ENTITY_TYPES = ["hscodes", "rfqs"] as const;

// Entity types that are part of the planned search surface (see
// docs/02-product-requirements.md §2.1, §3.4) but have no schema/data yet.
// Each dispatches to a stub that returns an empty array immediately.
export const STUBBED_SEARCH_ENTITY_TYPES = [
  "companies",
  "products",
  "ports",
  "warehouses",
  "documents",
] as const;

export const SEARCH_ENTITY_TYPES = [
  ...REAL_SEARCH_ENTITY_TYPES,
  ...STUBBED_SEARCH_ENTITY_TYPES,
] as const;

export type RealSearchEntityType = (typeof REAL_SEARCH_ENTITY_TYPES)[number];
export type StubbedSearchEntityType = (typeof STUBBED_SEARCH_ENTITY_TYPES)[number];
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export type SearchResult = {
  entityType: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
};

// Arbitrary, entity-specific narrowing (e.g. { category: "..." } for hscodes,
// { status: "OPEN" } for rfqs). Each entity search function picks the keys
// it understands and ignores the rest.
export type SearchFilters = Record<string, string | number | boolean | undefined>;

// Scoping context passed down from the API route so entity searches that
// need RLS-equivalent org scoping (rfqs, and later companies/products/
// warehouses/documents) can apply it the same way the rest of the app does
// (see src/core/identity/session.ts's AuthenticatedActor).
export type SearchContext = {
  organizationId: string | null;
};
