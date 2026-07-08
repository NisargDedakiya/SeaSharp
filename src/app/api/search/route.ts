import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { getRequestActor } from "@/core/identity/session";
import { search, SEARCH_ENTITY_TYPES } from "@/core/search";

const querySchema = z.object({
  type: z.enum(SEARCH_ENTITY_TYPES),
  q: z.string().min(1),
  filters: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filters must be a JSON object" });
        return z.NEVER;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filters must be valid JSON" });
        return z.NEVER;
      }
    }),
});

// GET /api/search?type=<entity>&q=<query>&filters=<json>
// See docs/06-api-integration-spec.md for the full contract, including which
// entity types are real (hscodes, rfqs) vs. stubbed (companies, products,
// ports, warehouses, documents — always return []).
export const GET = withApiHandler(
  async (request: Request) => {
    const url = new URL(request.url);
    const { type, q, filters } = querySchema.parse({
      type: url.searchParams.get("type"),
      q: url.searchParams.get("q"),
      filters: url.searchParams.get("filters") ?? undefined,
    });

    // Best-effort actor lookup: search works for anonymous callers (results
    // scoped to public data only), same as the marketplace listing. Also
    // the first route in this codebase reachable via API key
    // (`Authorization: Bearer sk_live_...`) — see
    // src/core/identity/session.ts#getRequestActor and
    // docs/06-api-integration-spec.md for why this endpoint was chosen and
    // /api/audit/... was not (yet).
    const actor = await getRequestActor(request).catch(() => null);

    const results = await search(type, q, filters, { organizationId: actor?.organization.id ?? null });
    return NextResponse.json({ type, query: q, results });
  },
  { rateLimit: { limit: 60, windowMs: 60_000 } }
);
