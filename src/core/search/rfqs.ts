import "server-only";
import { sql, eq, and } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { rfqs } from "@/db/schema";
import type { SearchContext, SearchFilters, SearchResult } from "./types";

const RFQ_STATUSES = ["OPEN", "AWARDED", "CANCELLED", "FULFILLED"] as const;
type RfqStatus = (typeof RFQ_STATUSES)[number];

// RFQs are org-owned. Mirroring the app-code scoping pattern used elsewhere
// (see listOpenRfqs in src/core/trade/marketplace.ts, which filters
// serviceDb reads explicitly rather than going through withRlsContext):
// unauthenticated/no-org callers only see OPEN RFQs (the same set the public
// marketplace listing exposes); callers with an organizationId additionally
// see their own org's RFQs regardless of status.
//
// The to_tsvector(...) expression here must exactly match the one baked
// into the "rfqs_fts_idx" GIN index (drizzle/0005_search_fts.sql).
export async function searchRfqs(
  query: string,
  filters: SearchFilters | undefined,
  context: SearchContext
): Promise<SearchResult[]> {
  const rawStatus = typeof filters?.status === "string" ? filters.status : undefined;
  const status = rawStatus && (RFQ_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as RfqStatus) : undefined;

  const ftsMatch = sql`to_tsvector('english', ${rfqs.product} || ' ' || ${rfqs.hsCode})
    @@ plainto_tsquery('english', ${query})`;

  const visibility = context.organizationId
    ? sql`(${rfqs.status} = 'OPEN' or ${rfqs.organizationId} = ${context.organizationId})`
    : sql`${rfqs.status} = 'OPEN'`;

  const rows = await serviceDb
    .select({
      id: rfqs.id,
      product: rfqs.product,
      hsCode: rfqs.hsCode,
      status: rfqs.status,
      rank: sql<number>`ts_rank(
        to_tsvector('english', ${rfqs.product} || ' ' || ${rfqs.hsCode}),
        plainto_tsquery('english', ${query})
      )`,
    })
    .from(rfqs)
    .where(status ? and(ftsMatch, visibility, eq(rfqs.status, status)) : and(ftsMatch, visibility))
    .orderBy(sql`ts_rank(
      to_tsvector('english', ${rfqs.product} || ' ' || ${rfqs.hsCode}),
      plainto_tsquery('english', ${query})
    ) desc`)
    .limit(20);

  return rows.map((r) => ({
    entityType: "rfqs" as const,
    id: r.id,
    title: r.product,
    subtitle: `HS ${r.hsCode} · ${r.status}`,
    url: `/marketplace/${r.id}`,
  }));
}
