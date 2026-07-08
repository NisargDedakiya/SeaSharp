import "server-only";
import { searchHsCodes } from "./hscodes";
import { searchRfqs } from "./rfqs";
import { searchStub } from "./stubs";
import {
  REAL_SEARCH_ENTITY_TYPES,
  STUBBED_SEARCH_ENTITY_TYPES,
  type SearchContext,
  type SearchEntityType,
  type SearchFilters,
  type SearchResult,
} from "./types";

export * from "./types";

// Single entry point for every entity search. This is a thin dispatcher on
// purpose — GET /api/search (src/app/api/search/route.ts) and any future
// caller (Task 5's dashboard widget, Task 6's public API) should only ever
// need to call `search(entityType, query, filters, context)`, never import
// an entity-specific search function directly.
export async function search(
  entityType: SearchEntityType,
  query: string,
  filters?: SearchFilters,
  context: SearchContext = { organizationId: null }
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  if ((REAL_SEARCH_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    switch (entityType) {
      case "hscodes":
        return searchHsCodes(query, filters);
      case "rfqs":
        return searchRfqs(query, filters, context);
    }
  }

  if ((STUBBED_SEARCH_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return searchStub(entityType as Exclude<SearchEntityType, "hscodes" | "rfqs">);
  }

  return [];
}

// Convenience for callers (e.g. the global search UI) that want results
// across every real entity type in one call, grouped by type.
export async function searchAll(
  query: string,
  filters?: SearchFilters,
  context?: SearchContext
): Promise<Record<string, SearchResult[]>> {
  const entries = await Promise.all(
    REAL_SEARCH_ENTITY_TYPES.map(async (entityType) => [entityType, await search(entityType, query, filters, context)] as const)
  );
  return Object.fromEntries(entries);
}
