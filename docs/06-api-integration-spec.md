# SeaSharp API & Integration Specification

> Status: v2.0 target architecture. See [docs/README.md](./README.md) for how
> this compares to what's actually shipped today (Phase 1 exposes
> unversioned `/api/...` routes — see the route handlers under `src/app/api/`).

## Conventions

- **Base path**: `/api/v1/...`. Versioned from the start of v2.0 so a future
  breaking change ships as `/api/v2/...` alongside `/v1` rather than breaking
  existing integrations.
- **Format**: JSON request and response bodies. `Content-Type:
  application/json` required on any request with a body.
- **Auth**: Supabase session (cookie) for first-party web/app clients;
  bearer API keys (`Authorization: Bearer sk_live_...`) for server-to-server
  and the future public API Platform (Phase 4).
- **Pagination**: cursor-based — `?cursor=<opaque>&limit=<n>` (max `limit`
  100), response includes `next_cursor: string | null`. No offset-based
  pagination (it doesn't paginate safely under concurrent writes).
- **Errors**: single shape across every endpoint —
  ```json
  { "error": { "code": "RFQ_DEADLINE_PASSED", "message": "This RFQ's bidding window has closed." } }
  ```
  `code` is a stable, machine-readable identifier (SCREAMING_SNAKE_CASE);
  `message` is human-readable and safe to display. Never leak stack traces or
  internal identifiers in `message`.
- **Idempotency**: any endpoint that moves money or triggers an external side
  effect accepts an `Idempotency-Key` header; replaying the same key with the
  same body returns the original response without re-executing the action.

## Resource endpoints (representative, not exhaustive)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/organizations` | Create an organization |
| `POST` | `/api/v1/organizations/:id/invitations` | Invite a member |
| `GET` | `/api/v1/rfqs` | List/search open RFQs (filters: product, country, status) |
| `POST` | `/api/v1/rfqs` | Post an RFQ (importer only) |
| `POST` | `/api/v1/rfqs/:id/bids` | Submit a bid (exporter only) |
| `POST` | `/api/v1/bids/:id/negotiate` | Submit a counter-offer |
| `POST` | `/api/v1/rfqs/:id/award` | Award a bid (importer only, transactional) |
| `POST` | `/api/v1/contracts/:id/sign` | Digitally sign a contract |
| `GET` | `/api/v1/shipments/:id` | Shipment detail + milestone history |
| `POST` | `/api/v1/shipments/:id/milestones` | Advance a shipment milestone |
| `POST` | `/api/v1/escrow/:id/release` | Release an escrow milestone (requires shipment milestone confirmed) |
| `POST` | `/api/v1/trade-loans` | Request PO/invoice financing |
| `GET` | `/api/v1/organizations/:id/trust-score` | Current STS breakdown |
| `GET` | `/api/v1/compliance/lookup` | Public, unauthenticated — HS code + tariff + document checklist |

Every mutating endpoint requires the caller's role/permission to be checked
against the target `organization_id` — see
[Technical Architecture § Multi-tenancy](./03-technical-architecture.md#multi-tenancy-model).

## Shipped: audit timeline endpoint

Unlike the rest of this document (v2.0 target architecture, see the status
note above), the following is a real, shipped, unversioned route —
`src/app/api/audit/[entityType]/[entityId]/route.ts` — added for Task 2's
audit trail (see
[docs/04-database-design.md#audit-timeline-read-model](./04-database-design.md#audit-timeline-read-model)).
It's the current codebase's equivalent of a future `GET
/api/v1/audit/:entityType/:entityId` and would move under `/api/v1` unchanged
whenever the rest of the API is versioned.

**`GET /api/audit/:entityType/:entityId`**

- **Auth**: Supabase-style session cookie (`getSessionActor()`), same as
  every other first-party route in this phase — no bearer-key/public access
  yet.
- **`entityType`**: one of `rfq`, `shipment` (validated with a Zod enum;
  anything else is a 400). A `shipment` id is resolved to its owning RFQ
  before the timeline is built, since every trade-lifecycle table is
  ultimately keyed on `rfq_id`.
- **Scope**: only a member of the RFQ's importer organization, or the
  organization whose bid was awarded on that RFQ, may read its timeline — a
  403 otherwise. A nonexistent entity is a 404.
- **Response**: `{ entityType, entityId, timeline: TimelineEntry[] }`, where
  each entry is `{ timestamp, actor: { profileId, name }, type,
  description, payload }`, sorted chronologically (oldest first).

Example:

```
GET /api/audit/rfq/bac007ce-c18b-4025-ad5b-0523441ca007
```

```json
{
  "entityType": "rfq",
  "entityId": "bac007ce-c18b-4025-ad5b-0523441ca007",
  "timeline": [
    {
      "timestamp": "2026-07-08T15:46:40.855Z",
      "actor": { "profileId": "5215e995-...", "name": "Importer Audit" },
      "type": "RFQ_CREATED",
      "description": "RFQ created",
      "payload": { "rfqId": "bac007ce-...", "product": "Widgets" }
    },
    {
      "timestamp": "2026-07-08T15:46:43.198Z",
      "actor": { "profileId": "5215e995-...", "name": "Importer Audit" },
      "type": "WORKFLOW_TRANSITIONED",
      "description": "Workflow transitioned: OPEN -> AWARDED",
      "payload": { "rfqId": "bac007ce-...", "fromNode": "OPEN", "toNode": "AWARDED", "workflowInstanceId": "fb656bc4-..." }
    }
  ]
}
```

Not yet wired into the dashboard — `src/components/dashboard/
AuditTimelineWidget.tsx` fetches and renders this endpoint standalone, ready
for a future dashboard task to place it. If a later phase exposes this
externally through the public API Platform (Phase 4+, see below), it will
need the same bearer-key auth and rate limiting as every other externally
exposed endpoint — nothing about it is safe to expose unauthenticated today,
since the payloads can carry internal ids/organization details.

## Shipped: search endpoint

Also a real, shipped, unversioned route (Task 4) —
`src/app/api/search/route.ts`, backed by the dispatcher in
`src/core/search/index.ts`. Postgres-native full-text search (`tsvector` +
GIN expression indexes, `drizzle/0005_search_fts.sql`) — no Elasticsearch/
Algolia, consistent with this project's "no new infra before it's needed"
approach elsewhere in the codebase.

**`GET /api/search?type=<entityType>&q=<query>&filters=<json>`**

- **Auth**: optional. Anonymous callers get public-only results (e.g. only
  `OPEN` RFQs); a signed-in caller's `organizationId` (via
  `getSessionActor()`) additionally surfaces their own org's non-public rows
  (e.g. their own `AWARDED`/`CANCELLED` RFQs). Rate-limited (60 req/min/IP).
- **`type`**: required, one of the full entity-type union —
  `hscodes`, `rfqs` (real, query hits Postgres), or
  `companies`, `products`, `ports`, `warehouses`, `documents` (stubbed —
  always return `results: []`; no schema/data or search UX for these yet,
  see `src/core/search/stubs.ts`). Anything else is a 400 (Zod enum).
- **`q`**: required, non-empty string.
- **`filters`**: optional, JSON-object-encoded query param. `hscodes`
  supports `{ "category": "..." }`; `rfqs` supports `{ "status": "OPEN" |
  "AWARDED" | "CANCELLED" | "FULFILLED" }`. Unrecognized keys are ignored
  rather than rejected.
- **Response**: `{ type, query, results: SearchResult[] }`, where
  `SearchResult` is `{ entityType, id, title, subtitle?, url? }`, ranked by
  Postgres `ts_rank` (best match first), capped at 20 rows.

Example (real — hscodes):

```
GET /api/search?type=hscodes&q=electric
```

```json
{
  "type": "hscodes",
  "query": "electric",
  "results": [
    { "entityType": "hscodes", "id": "850110", "title": "850110", "subtitle": "Electric motors (Machinery)" }
  ]
}
```

Example (real — rfqs):

```
GET /api/search?type=rfqs&q=widgets
```

```json
{
  "type": "rfqs",
  "query": "widgets",
  "results": [
    { "entityType": "rfqs", "id": "bac007ce-...", "title": "Widgets", "subtitle": "HS 850110 · AWARDED", "url": "/marketplace/bac007ce-..." }
  ]
}
```

Example (stubbed — companies):

```
GET /api/search?type=companies&q=acme
```

```json
{ "type": "companies", "query": "acme", "results": [] }
```

Indexed fields today: `hs_codes(code, description, category)` and
`rfqs(product, hs_code)` — RFQs have no separate title/description field,
only `product`, so that's the entirety of their free-text surface. A global
`Cmd+K` command-palette UI (`src/components/SearchPalette.tsx`, wired into
`Navbar.tsx`) calls this endpoint client-side, grouped by entity type.

Not yet exposed through the public API Platform (Phase 4+, see below) — if
it is, it should get the same bearer-key auth and rate limiting as every
other externally-exposed endpoint, and the stubbed entity types should
either be documented as perpetually-empty or removed from the union at that
boundary rather than silently returning `[]` forever. Also worth revisiting
for Task 5's dashboard, which may want a compact search widget reusing
`searchAll()` from `src/core/search/index.ts` instead of the full palette.

## Webhooks

### Inbound (third parties → SeaSharp)
| Source | Path | Notes |
|---|---|---|
| Stripe | `/api/v1/webhooks/stripe` | Signature-verified via `stripe-signature` header; idempotent on `event.id` |
| Carrier tracking (Flexport/Freightos, Phase 5) | `/api/v1/webhooks/carrier/:carrier` | Maps carrier-specific milestone vocab to SeaSharp's fixed `shipments.milestone` enum |
| Twilio (inbound SMS/WhatsApp replies) | `/api/v1/webhooks/twilio` | Signature-verified via Twilio's request validation |

### Outbound (SeaSharp → integrators, Phase 4+ API Platform)
Partners subscribe to event types (`rfq.awarded`, `shipment.milestone_updated`,
`escrow.released`) and receive a signed POST with an HMAC signature header
they verify against their registered secret. Delivery is at-least-once with
exponential backoff retry; consumers must handle duplicate delivery
(same idempotency guarantee SeaSharp itself requires from Stripe).

## Third-party integrations

| Integration | Purpose | Phase |
|---|---|---|
| Stripe | Payments, escrow funding, financing disbursement | 3 |
| Razorpay | India-specific payment rail | 3+ (market-dependent) |
| PayPal | Alternate payment rail | later, demand-dependent |
| Flexport / Freightos | Live freight rates + carrier tracking | 5 |
| Google Maps | Port/warehouse geocoding, route visualization | 2+ |
| Resend | Transactional email | 1 |
| Twilio | SMS / WhatsApp notifications | 2 |
| PostHog | Product analytics | 1+ |
| Sentry | Error tracking — carried forward unchanged from Phase 1 | 1 |

Every integration is wrapped behind a `lib/integrations/<name>.ts` adapter
with a narrow interface — the rest of the codebase calls the adapter, never
the third-party SDK directly. This is the same stub-first, swap-later
pattern used for AI services, applied to external integrations: a
`lib/integrations/freight.ts` interface can be backed by a static estimate
today and Flexport's real API in Phase 5 without touching callers.

## Versioning & deprecation policy

- A breaking change to a `v1` endpoint's request/response shape requires a
  new `v2` endpoint; `v1` is not mutated in place.
- Deprecated endpoints are announced with a `Sunset` header (RFC 8594) at
  least 90 days before removal.
- Internal (first-party web app) calls are not exempt from this policy once
  the public API Platform (Phase 4) ships — internal and external consumers
  share the same versioned contract, so the web app itself proves the API is
  usable by a third party.

## Authentication for the API Platform (Phase 4+)

- API keys are scoped per organization, per environment (`sk_test_...` /
  `sk_live_...`), and per permission set (read-only vs. read-write).
- Keys are shown once at creation and stored hashed — never retrievable
  again, only revocable and re-issuable.
- Rate limits are tiered by plan (see [Product Vision § Revenue model](./01-product-vision.md#revenue-model))
  and returned via standard `X-RateLimit-Limit` / `X-RateLimit-Remaining` /
  `X-RateLimit-Reset` headers.
