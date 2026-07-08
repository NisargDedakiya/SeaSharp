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

## Shipped: Public API Platform MVP (Task 6)

Unlike the target-architecture sections above (which describe the eventual
`/api/v1/...` surface), the following is real, shipped, unversioned code —
API keys, webhook delivery, and their management routes under
`src/app/api/`. It's the current codebase's first real instance of the
"Authentication for the API Platform" section above, scoped down to what a
single-instance MVP can support without new infra (no message queue, no
Redis).

### API keys

- **Table**: `api_keys` (`src/db/schema/api-platform.ts`) —
  `organizationId`, `createdByProfileId`, `name`, `keyPrefix` (unique,
  stored in the clear), `hashedSecret` (bcrypt, cost 10 — same approach as
  password hashing in `src/core/identity/adapter.ts`), `scopes` (jsonb
  string array), `createdAt`, `lastUsedAt`, `revokedAt`.
- **Format**: `sk_live_<12 hex chars>.<32-char base64url secret>`. The part
  before the `.` (`keyPrefix`) is the lookup key (indexed, unique, safe to
  log/display in a "your keys" list); the part after is bcrypt-compared
  against `hashedSecret` and never stored or logged in plaintext. There is
  no `sk_test_` split yet — every issued key is `sk_live_`; a test/live
  split is deferred (see "Deferred / ambiguous" below).
- **Issuance/validation/revocation**: `src/core/api-platform/keys.ts` —
  `issueApiKey()`, `validateApiKey(bearerToken)`, `revokeApiKey()`,
  `listApiKeys()`. `validateApiKey` bumps `lastUsedAt` on every successful
  check and returns `null` (never throws) on any failure, so callers can
  fall back to session-cookie auth without special-casing errors.
- **Scopes**: stored as a free-form string array (e.g. `["search:read"]`)
  but **not yet enforced** anywhere — issuing a key with any scope list
  currently grants that key full access to whatever routes accept API-key
  auth. Scope enforcement (checking `apiKey.scopes` against a route's
  required scope) is a follow-up, not built in this task; see "Deferred /
  ambiguous."

### `withApiHandler` / API-key auth (extends, doesn't fork, `src/lib/api-handler.ts`)

- New helper `getRequestActor(request)` in `src/core/identity/session.ts`
  resolves the same `{ organization, user }` shape every route already
  works with, from either credential:
  1. If an `Authorization: Bearer <token>` header is present, it is tried
     **first** as an API key (`validateApiKey`). On success, returns
     `{ organization, user: null, apiKey: { id, scopes } }` — `user` is
     `null` because an API key authenticates as the organization, not a
     specific person.
  2. Otherwise (no bearer header, or the bearer token doesn't validate as a
     live key), falls back to the existing session-cookie resolution
     (`getSessionActor()`).
  - **Documented resolution order**: API key first, cookie second. Rationale:
    server-to-server callers only ever send a bearer header, never a
    browser session cookie, so checking the header first avoids a wasted
    cookie lookup on every API-key call. A request carrying both is the
    unusual case (e.g. testing with curl) and "the explicit credential
    wins" is the least surprising behavior there.
  - `withApiHandler` itself is unchanged in shape (no new required option) —
    routes that want API-key support call `getRequestActor(request)` instead
    of `getSessionActor()`; routes that should stay session-only (all
    `/api/api-keys` and `/api/webhook-endpoints` routes, since managing your
    own integration config should not itself be delegatable to an API key)
    keep calling `getSessionActor()` unchanged.

### Which existing routes accept API keys today

- **`GET /api/search`** — now accepts either credential via
  `getRequestActor()`. Chosen as the first API-key-reachable route because
  it already supported anonymous/optional auth, so extending it to also
  accept a bearer key was a strict widening with no new authorization logic
  to get wrong.
- **`GET /api/audit/:entityType/:entityId`** — **left session-cookie-only**,
  deliberately. Its authorization check (importer-or-awarded-exporter) reads
  `actor.user`/org membership directly and its payloads carry internal
  ids/organization details (see the note this file already had before this
  task). Extending it to API keys needs a scope decision first (e.g. an
  `audit:read` scope, enforced) rather than silently granting any key full
  read access to another org's dispute history — flagged as a follow-up.
- **`/api/api-keys`**, **`/api/webhook-endpoints`** (new, below) —
  session-cookie only, by design (see above).
- No other existing route was changed.

### Rate limiting (extends `src/lib/rate-limit.ts`)

- New `rateLimitKeyFromRequest(request)`: if the request carries a bearer
  token starting with `sk_live_`, the rate-limit bucket key is
  `apikey:<keyPrefix>` (prefix only — no DB/bcrypt lookup, so computing the
  bucket key never costs a database round trip); otherwise it's `ip:<ip>`,
  same as before. `withApiHandler`'s `options.rateLimit` block now calls
  this instead of `clientIpFromRequest` directly.
- Still the same in-memory fixed-window limiter as before (per-process, not
  shared across instances — see that file's existing header comment); an
  API key's limit is enforced per-process just like IP-based limits are
  today. No per-plan tiering yet (every key/route uses whatever
  `options.rateLimit` the route itself specifies) — tiered limits by plan
  remain a Phase 4+ item per the section above.

### Webhooks

- **Tables** (`src/db/schema/api-platform.ts`):
  - `webhook_endpoints` — `organizationId`, `url`, `secret` (HMAC signing
    key, `whsec_...`, shown once at creation, never re-returned — unlike
    `api_keys.hashedSecret` this is stored as-issued rather than hashed,
    because signing every delivery requires reading it back, the same
    tradeoff a Stripe-style webhook secret makes), `eventTypes` (jsonb
    string array of `EVENT_TYPES` the endpoint wants), `createdAt`,
    `revokedAt`.
  - `webhook_deliveries` — one row per delivery *attempt* (not a queue):
    `webhookEndpointId`, `organizationId` (denormalized for simple RLS),
    `eventType`, `payload`, `status` (`SUCCESS`/`FAILED`), `responseStatus`,
    `errorMessage`, `deliveredAt`.
- **Delivery**: `src/core/api-platform/webhooks.ts#deliverWebhooksForEvent`,
  registered as a **new event-bus subscriber** in
  `src/core/events/subscribers.ts` — same "one event, many subscribers"
  pattern as the existing audit-log and notification subscribers; no new
  event-writing path was added anywhere. On every emitted event with an
  `organizationId`, it looks up that org's non-revoked endpoints subscribed
  to the event's type and fires one HTTP POST per endpoint, concurrently.
- **Signature**: `X-SeaSharp-Signature: t=<unix seconds>,v1=<hex hmac-sha256>`
  computed over `${timestamp}.${rawBody}` with the endpoint's `secret` —
  the same `t=...,v1=...` shape as Stripe's `Stripe-Signature` header,
  renamed to this project's convention. `X-SeaSharp-Timestamp` is also sent
  as a plain header for convenience. Verifying parties should recompute the
  HMAC over `${timestamp}.${body}` and reject stale timestamps to defeat
  replay of a captured payload (the same guidance Stripe gives integrators).
- **Delivery semantics — MVP scope, documented limitation**: single
  best-effort attempt per event per endpoint, 5s timeout, no retry/backoff
  and no dead-letter queue. A non-2xx response or network error is recorded
  as `status: 'FAILED'` in `webhook_deliveries` with `errorMessage` and
  logged, but nothing re-attempts it. At-least-once delivery with
  exponential-backoff retry (described earlier in this doc's "Outbound"
  webhooks section as the eventual target) requires durable job
  infrastructure (a queue table + worker, or an external queue) that is
  explicitly out of scope here per this project's "no new infra before it's
  needed" rule — **this is a known gap for a production integrator surface,
  called out here rather than silently shipped as if it were complete.**
- **Verified live** (not just typechecked): a throwaway local HTTP listener
  received a real POST with a correctly HMAC-signed
  `X-SeaSharp-Signature` header when an `RFQ_CREATED` event fired, and the
  attempt was recorded in `webhook_deliveries` as `SUCCESS` with
  `response_status: 200`. See this task's commit message / PR description
  for the exact commands used.

### New management routes (session-cookie auth only)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/api-keys` | List the caller's organization's API keys (never returns secrets) |
| `POST` | `/api/api-keys` | Issue a new key — `{ name, scopes }` → `{ id, keyPrefix, key }` (`key` shown once) |
| `DELETE` | `/api/api-keys/:id` | Revoke a key (sets `revokedAt`; 404 if not found/not yours/already revoked) |
| `GET` | `/api/webhook-endpoints` | List the caller's organization's webhook endpoints (never returns the secret) |
| `POST` | `/api/webhook-endpoints` | Register an endpoint — `{ url, eventTypes }` → `{ id, url, eventTypes, secret }` (`secret` shown once) |
| `DELETE` | `/api/webhook-endpoints/:id` | Revoke an endpoint (sets `revokedAt`) |

Example — issue a key and call `/api/search` with it:

```
POST /api/api-keys
Cookie: seasharp_session=...
{ "name": "my integration", "scopes": ["search:read"] }
```
```json
{ "id": "a4e1e7e0-...", "keyPrefix": "sk_live_421fdabbeb78", "key": "sk_live_421fdabbeb78._yjELzrUGVyl6dCqfIOWFthZ6hoee14K" }
```
```
GET /api/search?type=hscodes&q=electric
Authorization: Bearer sk_live_421fdabbeb78._yjELzrUGVyl6dCqfIOWFthZ6hoee14K
```
```json
{ "type": "hscodes", "query": "electric", "results": [ { "entityType": "hscodes", "id": "850110", "title": "850110", "subtitle": "Electric motors (Machinery)" } ] }
```

Example — register a webhook endpoint and receive a delivery:

```
POST /api/webhook-endpoints
Cookie: seasharp_session=...
{ "url": "https://example.com/hooks/seasharp", "eventTypes": ["RFQ_CREATED", "RFQ_AWARDED"] }
```
```json
{ "id": "ffca0e6a-...", "url": "https://example.com/hooks/seasharp", "eventTypes": ["RFQ_CREATED", "RFQ_AWARDED"], "secret": "whsec_d6BCLoSx7KTxuktBfb5Ez4TsPs0rF2md" }
```

Delivery received at `https://example.com/hooks/seasharp`:

```
POST /hooks/seasharp
X-SeaSharp-Signature: t=1783527570,v1=63899f40d487e95f9b9704e05d195e833ab2aebeddb78dedd6200193f2af9fd2
X-SeaSharp-Timestamp: 1783527570

{"type":"RFQ_CREATED","payload":{"rfqId":"9a9f3863-...","product":"Test Widgets"},"organizationId":"67e54570-..."}
```

### Migration & RLS

- `drizzle/0007_api_platform.sql` — creates `api_keys`, `webhook_endpoints`,
  `webhook_deliveries`.
- `drizzle/manual/11_api_platform_rls.sql` — enables RLS and adds
  `org_members_select_*` policies on all three tables, same
  `is_org_member(organization_id)` pattern as
  `08_workflow_rls.sql`/`10_dashboard_layouts_rls.sql`. All writes go
  through `serviceDb` (service-role connection) from the route handlers /
  `keys.ts` / `webhooks.ts`, same as every other privileged write path in
  this codebase — the RLS policies are the defense-in-depth backstop for
  future client-side/`APP_DATABASE_URL` reads, not the primary access
  control today.

### Phase 2 stub: OAuth

OAuth (an integrator authorizing SeaSharp to act on their behalf via a
third-party-hosted authorization flow, refresh tokens, per-user delegated
scopes) is **not built** in this task. API keys + webhooks are the complete
MVP integrator surface for now: a key authenticates as an *organization*
(server-to-server, held by the integrator, never delegated per end-user),
which covers every current use case (pulling search results, receiving
event webhooks) without needing an authorization-code flow, token refresh,
or a consent screen. OAuth becomes necessary once a third party needs to
act *as a specific SeaSharp user* inside their own product (e.g. "Connect
your SeaSharp account" in a partner's app) rather than as their own backend
service — that's a distinct Phase 2 capability, deferred until a concrete
partner integration needs it.

### Deferred / ambiguous — flagged for follow-up

- **Scope format and enforcement**: `scopes` is a free-form string array
  with no fixed catalog and no enforcement — any key with any scope list
  gets full access to whatever it's presented against. A real scope catalog
  (e.g. `search:read`, `audit:read`, `webhooks:manage`) plus a
  `requireScope()` check in routes that accept API keys is needed before
  this is safe to hand to a real external integrator.
  Follow-up: define the scope catalog and enforce it before onboarding any
  external
  partner.
- **`sk_test_` / `sk_live_` split**: not implemented — every key is
  `sk_live_`. A test-mode key that only works against sandbox data (the
  convention this doc already described above) is a follow-up.
- **Webhook retry**: single best-effort attempt only, no backoff/retry/dead-letter
  queue — see "Delivery semantics" above. This is the most significant MVP
  gap for a production integrator surface and should be the first thing
  revisited.
- **Audit endpoint API-key access**: intentionally left session-only for now
  (see "Which existing routes accept API keys today"); needs a scope
  decision, not just a wiring change.
- **Rate-limit tiering by plan**: not implemented — every route still uses
  a single fixed `options.rateLimit` value regardless of caller/plan.
