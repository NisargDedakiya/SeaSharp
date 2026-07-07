# SeaSharp Technical Architecture

> Status: v2.0 target architecture. See [docs/README.md](./README.md) for how
> this compares to what's actually shipped today.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript | Server Components by default; Client Components only where interactivity requires it |
| Styling | Tailwind CSS + shadcn/ui | shadcn components live in-repo (not a black-box dependency) so they can be themed to the SeaSharp brand — see [Design System](./05-ui-ux-design-system.md) |
| Backend | Next.js API Routes (Route Handlers) | Supabase Edge Functions only where a workload needs to run outside the Next.js request lifecycle (e.g. scheduled jobs, webhook fan-out) |
| Database | Supabase PostgreSQL | See [Database Design](./04-database-design.md) |
| ORM | Drizzle ORM | Chosen over Prisma/raw Supabase client for type-safe schema-as-code and zero runtime codegen step |
| Auth | Supabase Auth | Email/password at launch; OAuth providers and MFA are additive, not blocking |
| Storage | Supabase Storage | Buckets: `company-documents`, `trade-documents`, `shipment-files`, `contracts`, `certificates`, `user-avatars`, `logos`, `attachments` |
| Realtime | Supabase Realtime | RFQ updates, shipment tracking, notifications, chat, live dashboard widgets |
| Payments | Stripe | Escrow and wallet funding events are Stripe webhook-driven, never client-confirmed |
| Email | Resend | Transactional email (invitations, notifications, receipts) |
| Validation | Zod | Every route and form validates input at the boundary — same discipline as Phase 1 |
| Forms | React Hook Form | Paired with Zod resolvers |
| Charts | Recharts | Dashboard and admin analytics |
| Testing | Vitest (unit/integration), Playwright (E2E) | Mirrors Phase 1's test discipline, extended with browser E2E for critical flows (RFQ lifecycle, escrow release, auth) |
| Deployment | Vercel | Supabase project per environment (dev/staging/prod) |

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
   that are unit-testable without a database — mirrors `src/lib/sts.ts` vs.
   `src/lib/sts-server.ts` in Phase 1.
7. **AI services ship as documented, deterministic stubs first.** Real models
   swap in behind the same interface later — never block a feature launch on
   a trained model being ready.

## Folder structure

```
src/
  app/                        # Next.js App Router — routes + layouts
    (marketing)/               # public site: home, pricing, features, blog...
    (app)/                     # authenticated app shell
      [org]/                  # org-scoped routes (dashboard, marketplace, ...)
    api/                       # Route Handlers, one folder per resource
  components/
    ui/                        # shadcn primitives, themed
    landing/                   # marketing-page-only components
    org/                       # organization/team/RBAC components
    marketplace/
    logistics/
    finance/
    admin/
  db/
    schema/                    # Drizzle schema, one file per domain (see Database Design)
    queries/                   # composable query functions, no route-handler logic here
    migrations/                # generated Drizzle migrations
  lib/
    auth/                      # Supabase Auth helpers, session/org context
    ai/                        # AI service interfaces + stub implementations
    validation/                # shared Zod schemas
    api-handler.ts             # centralized route wrapper (carried from Phase 1)
    logger.ts
    rate-limit.ts
  emails/                      # React Email templates sent via Resend
tests/
  unit/
  integration/
  e2e/                          # Playwright specs
supabase/
  migrations/                  # SQL migrations (mirrors db/migrations for Supabase CLI)
  functions/                    # Edge Functions
```

Route-handler code stays thin: parse input, call a `db/queries/` function or
a `lib/` service, map the result to a response. Business logic does not live
inline in `app/api/**/route.ts` files — this was a Phase 1 convention
(`src/lib/rfqs.ts`, `src/lib/sts.ts` etc. as the logic layer under thin route
handlers) and continues unchanged.

## Multi-tenancy model

Every domain table carries an `organization_id`. Access control is enforced
in two layers, not one:

1. **Row Level Security (RLS)** at the Postgres level — the last line of
   defense, so a bug in application code cannot leak cross-tenant data.
2. **Application-level authorization** — RBAC checks in `lib/auth/` before a
   query is even issued, so users get a clean 403 instead of an empty result
   set caused by RLS silently filtering rows.

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

- Supabase Auth session cookies, httpOnly, secure, SameSite=Lax.
- RLS policies per table (see [Database Design § RLS](./04-database-design.md#row-level-security)).
- Security headers (CSP, HSTS, X-Frame-Options, etc.) — carried forward from
  Phase 1's `next.config.mjs` configuration verbatim.
- Secrets (Stripe keys, Resend keys, Supabase service role key) never touch
  the client bundle; service-role Supabase client is only instantiated in
  server-only modules.
- File uploads to Supabase Storage are scanned before being linked to a
  record other parties can see.
- Every admin action and every money-movement action is audit-logged
  (see [PRD § Audit Logs](./02-product-requirements.md#15-audit-logs)).

## Deployment

- **Environments**: `dev` (local + preview deploys), `staging`, `production`
  — each with its own Supabase project, not shared schemas in one project.
- **Vercel** for the Next.js app, with preview deployments per PR.
- **Supabase CLI migrations** run in CI before a deploy is promoted; a
  migration that fails blocks the deploy rather than partially applying.
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
