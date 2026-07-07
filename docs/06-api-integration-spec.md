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
