import "server-only";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { hsCodes } from "@/db/schema";
import type { SearchFilters, SearchResult } from "./types";

// Reference data, globally shared — no organizationId scoping needed.
// The to_tsvector(...) expression here must exactly match the one baked
// into the "hs_codes_fts_idx" GIN index (drizzle/0005_search_fts.sql) or
// Postgres will fall back to a sequential scan.
export async function searchHsCodes(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  const category = typeof filters?.category === "string" ? filters.category : undefined;

  const rows = await serviceDb
    .select({
      code: hsCodes.code,
      description: hsCodes.description,
      category: hsCodes.category,
      rank: sql<number>`ts_rank(
        to_tsvector('english', ${hsCodes.code} || ' ' || ${hsCodes.description} || ' ' || ${hsCodes.category}),
        plainto_tsquery('english', ${query})
      )`,
    })
    .from(hsCodes)
    .where(
      category
        ? sql`to_tsvector('english', ${hsCodes.code} || ' ' || ${hsCodes.description} || ' ' || ${hsCodes.category})
              @@ plainto_tsquery('english', ${query})
              and ${hsCodes.category} = ${category}`
        : sql`to_tsvector('english', ${hsCodes.code} || ' ' || ${hsCodes.description} || ' ' || ${hsCodes.category})
              @@ plainto_tsquery('english', ${query})`
    )
    .orderBy(sql`ts_rank(
      to_tsvector('english', ${hsCodes.code} || ' ' || ${hsCodes.description} || ' ' || ${hsCodes.category}),
      plainto_tsquery('english', ${query})
    ) desc`)
    .limit(20);

  return rows.map((r) => ({
    entityType: "hscodes" as const,
    id: r.code,
    title: r.code,
    subtitle: `${r.description} (${r.category})`,
  }));
}
