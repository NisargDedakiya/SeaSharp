# SeaSharp Technical Architecture

> Status: the database, ORM, RLS, multi-tenancy, and identity/RBAC sections
> below are live. This project deliberately does not use Supabase for
> anything (Auth, hosted Postgres, Storage, or Realtime) — plain,
> self-hosted Postgres is the whole database story. Next.js 15, email
> (Resend), and identity/RBAC are live; Stripe, Twilio, and PostHog are
> still target-only. See [docs/README.md](./README.md) for the full
> comparison.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript | Server Components by default; Client Components only where interactivity requires it |
| Styling | Tailwind CSS + shadcn/ui | shadcn components live in-repo (not a black-box dependency) so they can be themed to the SeaSharp brand — see [Design System](./05-ui-ux-design-system.md) |
| Backend | Next.js API Routes (Route Handlers) | A separate worker process only where a workload needs to run outside the Next.js request lifecycle (e.g. scheduled jobs, webhook fan-out) — not built yet |
| Database | Plain, self-hosted PostgreSQL | No Supabase. See [Database Design](./04-database-design.md) |
| ORM | Drizzle ORM | Chosen over Prisma for type-safe schema-as-code and zero runtime codegen step |
| Auth | Plain Postgres, bcrypt + signed JWT | `src/core/identity/adapter.ts` owns `auth.users` directly — bcrypt-hashed passwords, a JWT session cookie verified locally with no external provider or network call. See [top-level README § Auth: plain Postgres, no Supabase](../README.md#auth-plain-postgres-no-supabase) |
| Storage | Local disk (`src/core/storage/local-storage.ts`) | Scoped to KYC/KYB document uploads only — no signed URLs, bucket policies, or CDN. A general-purpose object store is a future gap, not assumed to be Supabase Storage |
| Realtime | Polling (`CountdownTimer`) | RFQ updates, shipment tracking, notifications, chat, live dashboard widgets are all still poll/refresh-based — no push channel yet |
| Payments | Stripe | Escrow and wallet funding events are Stripe webhook-driven, never client-confirmed |
| Email | Resend | Transactional email (invitations, notifications, receipts) — `src/integrations/resend/index.ts`, gated on `RESEND_API_KEY` (logs instead of sending when unset) |
| Validation | Zod | Every route and form validates input at the boundary — same discipline as Phase 1 |
| Forms | React Hook Form | Paired with Zod resolvers |
| Charts | Recharts | Dashboard and admin analytics |
| Testing | Vitest (unit/integration), Playwright (E2E) | Mirrors Phase 1's test discipline, extended with browser E2E for critical flows (RFQ lifecycle, escrow release, auth) |
| Deployment | Vercel (app) + any self-hosted Postgres instance per environment (dev/staging/prod) | No Supabase project |

## Guiding principles (carried forward from Phase 1)

These held up well in the MongoDB-based Phase 1 implementation and are not
being renegotiated for v2.0:

1. **Validate at the boundary.** Every API route parses input with Zod before
   touching business logic.
2. **Centralize error handling.** One `withApiHandler`-style wrapper per
   route: known errors map to status codes, unknowns become a 500 with
   internals hidden in production and reported to an error tracker.
3. **Structured logging.** One log line per request with a request ID,
   status, and latency.
4. **Rate limit anything public or auth-related.** Registration, login, and
   any unauthenticated endpoint (e.g. the Compliance Checker) are rate
   limited from day one.
5. **Server/client boundary is enforced by tooling, not convention.** Every
   module that touches the database is marked so a Client Component
   accidentally importing it fails the build — the `server-only` package
   pattern used in Phase 1 continues to apply verbatim.
6. **Pure logic is separated from I/O.** Scoring, calculation, and matching
   logic (STS, landed cost, credit scoring) lives in dependency-free modules
   that are unit-testable without a database — e.g. `src/core/finance/sts.ts`
   (pure) vs. `src/core/finance/sts-server.ts` (DB-backed).
7. **AI services ship as documented, deterministic stubs first.** Real models
   swap in behind the same interface later — never block a feature launch on
   a trained model being ready. **AI never owns business logic** — it's
   always called by an engine, which decides what to do with the result.

## Folder structure

This is the live layout, not a target:

```
src/
  app/                         # Next.js App Router — routes + layouts
    api/                        # Route Handlers, one folder per resource
    marketplace/, dashboard/, ... # pages
  components/                  # presentational + client-interactive UI
  core/                        # the Core Engine — see below
    identity/                   # Identity Engine: auth adapter, sessions, orgs, RBAC
    trade/                       # Trade Engine: intelligence (HS/tariffs/compliance), marketplace (RFQ listing)
    logistics/                   # Logistics Engine: calls RouteAI for freight recommendations
    finance/                     # Finance Engine: STS scoring, escrow milestone constants
    ai/                          # AI Platform: compliance-ai, credit-ai, route-ai, market-ai (each a documented stub)
    notifications/                # Notification Service: notify() — the only writer of the notifications table
    events/                       # Event Bus: emit()/subscribe(), domain_events table, audit-log + notification subscribers
    workflow/                     # Workflow Engine: cross-cutting transition rules (RFQ status, escrow milestone order)
  integrations/                # one folder per third party, narrow interface + documented stub
    stripe/, resend/, twilio/, maps/, freight/, government/
  db/
    schema/                      # Drizzle schema, one file per domain (see Database Design)
    client.ts                    # serviceDb (RLS bypass) + withRlsContext()
  lib/                         # cross-cutting infra, not domain logic
    api-handler.ts               # centralized route wrapper
    env.ts, logger.ts, rate-limit.ts, countries.ts
tests/
  unit/                         # one file per core/ module with pure logic
  integration/                  # full lifecycle tests against a real disposable Postgres db
drizzle/
  manual/                       # hand-written SQL: RLS policies, roles, auth.uid()
```

**The Core Engine vs. everything else**: `app/` and `components/` are
consumers, never sources of business logic — a route handler parses input,
calls into `core/<engine>/`, and maps the result to a response (see
`src/app/api/rfqs/[id]/award/route.ts` for the clearest example: it reads
like an orchestration script, not a place where escrow/workflow rules are
decided). `core/ai/` is a dependency of the other engines, never the other
way around — `src/core/logistics/index.ts` calling into
`src/core/ai/route-ai.ts` is the reference example of "engine calls AI, AI
returns a recommendation, engine decides what to do with it."

## Event system

Every business action a route handler completes emits a domain event via
`src/core/events`'s `emit()` — see `src/core/events/types.ts` for the
current catalog (`RFQ_CREATED`, `BID_SUBMITTED`, `RFQ_AWARDED`,
`ESCROW_MILESTONE_RELEASED`, `SHIPMENT_DELIVERED`, `KYC_VERIFIED`,
`KYC_PENDING`, `LOAN_DECIDED`, `WORKFLOW_TRANSITIONED`). `emit()` does two
things, always:

1. Persists the event to the `domain_events` table (an append-only log —
   this is the record future analytics/AI training pipelines read from).
2. Runs every registered subscriber (`src/core/events/subscribers.ts`):
   today that's an audit-log writer (the only writer of `audit_logs`) and a
   notification dispatcher that reads `payload.recipientProfileIds` and
   calls `core/notifications`'s `notify()` for each one.

A route decides *who* should be notified about its own event (by including
`recipientProfileIds` in the payload) — the event bus and its subscribers
never re-derive that from scratch. This keeps notification-worthiness a
business decision made where the context already exists, not a rule buried
in a generic dispatcher.

Events are dispatched synchronously, in-process, after the triggering
transaction has already committed — a subscriber failure is logged and
swallowed (see `bus.ts`), never rolled back into the business transaction
that already succeeded.

## Workflow engine

`src/core/workflow/engine.ts` is the single source of truth for "where is
this trade right now," replacing the three independent state fields
(`rfqs.status`, `escrow_milestones`, `shipments.transportStage`) that used to
each own their own slice with no unified instance:

- `workflow_definitions` — named, versioned transition graphs (currently one:
  `trade-lifecycle` v1), stored as the same `Record<node, node[]>` shape
  `RFQ_TRANSITIONS` already used, just generalized and persisted instead of
  hardcoded per-caller.
- `workflow_instances` — one row per in-flight trade (keyed on `rfq_id`),
  pointing at a definition and holding `current_node`.
- `workflow_history` — an immutable row per transition (`from_node`,
  `to_node`, actor, metadata) — the durable read-model the Task 2 audit
  timeline is built on. There is no separate `workflow_events` table: a
  transition already emits a `WORKFLOW_TRANSITIONED` domain event via
  `src/core/events`'s `emit()` (see `src/db/schema/workflow.ts` for why that
  collapse is deliberate, not an oversight).

`engine.ts#advanceInTx(tx, params)` validates the move against the
definition's graph (via `trade-workflow.ts`'s `assertTransition()`, unchanged
and reused, not reimplemented), updates `workflow_instances.currentNode`, and
writes the `workflow_history` row — all inside the caller's existing
`serviceDb.transaction()`, so it commits atomically with `rfqs.status`,
`escrow_milestones`, and `shipments` writes rather than opening a second
transaction. `emitTransition()` fires the domain event once that transaction
has committed, mirroring how the award/release routes already call `emit()`
only after their own transaction resolves.

The graph models the full lifecycle from the Product Vision (`INQUIRY` →
`OPEN` → `NEGOTIATION` → `CONTRACT` → `AWARDED` → `PRODUCTION` → `WAREHOUSE`
→ `PICKUP` → `EXPORT_CUSTOMS` → `SHIPPING` → `IMPORT_CUSTOMS` →
`CUSTOMS_CLEARED` → `DELIVERY` → `PAYMENT` → `FULFILLED`), plus the direct
shortcuts today's code actually takes where an intermediate stage has no
table/route yet (`OPEN` → `AWARDED`, `AWARDED` → `PICKUP`, `DELIVERY` →
`FULFILLED`) — see `TRADE_LIFECYCLE_GRAPH`'s comments in `engine.ts`.
Negotiation, Contract, and Production/Warehouse still have no table/route;
wiring them up is calling `advanceInTx()` with the finer-grained node, not
inventing a new representation.

`src/core/workflow/trade-workflow.ts`'s `assertRfqTransition` and
`assertSequentialAdvance` remain as thin, independently-testable wrappers
around the same rule for callers that only care about the RFQ-status or
sequential-index slice.

## Multi-tenancy model

Every domain table carries an `organization_id`. Access control is enforced
in two layers, not one:

1. **Row Level Security (RLS)** at the Postgres level — the last line of
   defense, so a bug in application code cannot leak cross-tenant data.
2. **Application-level authorization** — RBAC checks in `core/identity/`
   before a query is even issued, so users get a clean 403 instead of an
   empty result set caused by RLS silently filtering rows.

Never rely on RLS alone for UX (empty states from silently-filtered queries
are confusing) and never rely on application checks alone for security
(a missed check must not equal a data breach).

## API standards

See [API & Integration Specification](./06-api-integration-spec.md) for the
full contract. Summary:

- REST-style Route Handlers under `/api/v1/...` (versioned from day one of
  v2.0, unlike Phase 1's unversioned `/api/...`).
- JSON in, JSON out. Errors follow a single `{ error: { code, message } }`
  shape.
- Idempotency keys required on any endpoint that moves money (escrow funding,
  financing disbursement) or triggers an external side effect (Stripe charge).
- Webhooks (Stripe, carrier tracking updates) are verified by signature and
  processed idempotently — a replayed webhook must be a no-op.

## Security

- Own signed-JWT session cookies (`src/core/identity/adapter.ts`), httpOnly,
  secure, SameSite=Lax — no external auth provider.
- RLS policies per table (see [Database Design § RLS](./04-database-design.md#row-level-security)).
- Security headers (CSP, HSTS, X-Frame-Options, etc.) — carried forward from
  Phase 1's `next.config.mjs` configuration verbatim.
- Secrets (Stripe keys, Resend keys, the Postgres service-role connection
  string) never touch the client bundle; the service-role DB connection is
  only instantiated in server-only modules.
- File uploads (local disk today, see `src/core/storage/local-storage.ts`)
  are scanned before being linked to a record other parties can see.
- Every admin action and every money-movement action is audit-logged
  (see [PRD § Audit Logs](./02-product-requirements.md#15-audit-logs)).

## Deployment

- **Environments**: `dev` (local + preview deploys), `staging`, `production`
  — each with its own Postgres database, not shared schemas in one instance.
- **Vercel** for the Next.js app, with preview deployments per PR.
- **Drizzle migrations** (`drizzle/`) run in CI before a deploy is promoted;
  a migration that fails blocks the deploy rather than partially applying.
- **Health check**: `/api/health` reports real DB connectivity, mirroring
  Phase 1's health endpoint — required for any orchestrator/uptime monitor.
- **CI** (GitHub Actions): lint, typecheck, unit + integration tests,
  Playwright E2E against a preview deploy, build. Same shape as Phase 1's
  `ci.yml`, extended with an E2E stage.

## What does *not* change from Phase 1

The engineering discipline established in Phase 1 — validation, centralized
error handling, structured logging, rate limiting, security headers,
`server-only` boundaries, pure-logic-vs-I/O separation, tests + CI, Docker for
local parity — is the foundation this architecture builds on. v2.0 changes
*which* database and auth provider sit underneath that discipline; it does
not relax the discipline itself.
