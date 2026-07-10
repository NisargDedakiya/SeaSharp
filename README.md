# SeaSharp — The Global Trade Infrastructure Platform

> **Docs**: see [`docs/`](./docs/README.md) for the full v2.0 product/technical
> "constitution" (vision, PRD, architecture, database design, design system,
> API spec).

An RFQ marketplace, compliance/trade-route intelligence, logistics
estimation, and PO-backed trade finance in one closed-loop platform — the
foundation for a broader global trade ecosystem (freight forwarders, customs
brokers, warehouse providers, banks, and insurers), built around
organizations, RBAC, and a SeaSharp Trust Score (STS) that gates bid
visibility and financing rates.

Built to a production-hardening bar: Postgres with real transactions and Row
Level Security, centralized validation/error-handling/logging, rate
limiting, security headers, automated tests + CI, error tracking, a health
endpoint, and Docker packaging. See [Production hardening](#production-hardening)
below.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS, `framer-motion`
- **Postgres via Drizzle ORM**, with real Row Level Security — see
  [Row Level Security](#row-level-security) below
- `src/core/identity/adapter.ts` — self-contained identity/auth: bcrypt-hashed
  passwords in a plain `auth.users` table, signed-JWT session cookies
  verified locally with no external provider or network call. No Supabase —
  see [Auth: plain Postgres, no Supabase](#auth-plain-postgres-no-supabase)
  below
- Organizations + RBAC (`organizations`, `organization_members`, `roles`,
  `permissions`) — every registered account gets its own organization; the
  exporter/importer distinction from earlier phases is now the
  organization's `type`
- Vitest (unit + integration against a real disposable Postgres database),
  GitHub Actions CI (with a Postgres service container)
- Sentry (`@sentry/nextjs`), pino structured logging
- Docker / docker-compose

## Architecture

Business logic lives in `src/core/<engine>/` (Identity, Trade, Logistics,
Finance, AI, Notifications, Events, Workflow) — `app/api/**/route.ts`
handlers stay thin: parse input, call an engine, map the result to a
response. See
[docs/03-technical-architecture.md § Folder structure](./docs/03-technical-architecture.md#folder-structure)
for the full layout and the reasoning behind it. Three things worth knowing
up front:

- **AI never owns business logic.** `src/core/ai/` (ComplianceAI, CreditAI,
  RouteAI, MarketAI) only returns recommendations; the calling engine
  decides what to do with them.
- **Every business action emits an event.** `src/core/events`'s `emit()`
  persists to an append-only `domain_events` table and fans out to
  subscribers — today that's an audit-log writer and an in-app notification
  dispatcher (`src/core/notifications/`). See
  [docs/03-technical-architecture.md § Event system](./docs/03-technical-architecture.md#event-system).
- **Third-party integrations live behind `src/integrations/<provider>/`.**
  `resend/` and `twilio/` are wired into the notification service today
  (inert without an API key, like Sentry); `stripe/`, `maps/`, `freight/`,
  and `government/` are reserved locations for features not built yet, not
  live code.

## What's implemented

- **Identity & Organizations**: email/password registration creates an
  `auth.users` row, a `profiles` row, a brand-new `organizations` row (typed
  `EXPORTER` or `IMPORTER` today), and an `organization_members` row with the
  system `Owner` role — all in one transaction.
- **Trade Intelligence**: HS code lookup, tariff calculator, landed cost
  calculator, and document checklist for 5 launch trade zones (India, UAE,
  USA, EU, China), exposed as a public "Free Compliance Checker" (the GTM
  viral wedge) at `/compliance-checker`.
- **RFQ Marketplace**: RFQ posting, blind bidding (exporters never see
  competitors' prices), bid award, and escrow with milestone-gated fund
  release at `/marketplace`, plus search/sort and verified-organization
  badges on the browse page.
- **Logistics**: a RouteIQ-stub freight recommendation (mode + cost estimate)
  generated automatically when a bid is awarded.
- **Trade Finance**: PO-backed trade finance requests scored by a
  CreditLayer stub keyed off the exporter organization's SeaSharp Trust Score.
- **SeaSharp Trust Score (STS)**: composite 0–1000 score (KYC, on-time
  delivery, escrow speed, dispute rate, loan repayment) recalculated after
  every fulfilled trade — pure logic in `src/core/finance/sts.ts`, DB-backed
  persistence in `src/core/finance/sts-server.ts`.
- **KYC/KYB**: a ComplianceAI-stub check (`src/core/ai/compliance-ai.ts`)
  gates an organization's verification status, which feeds into STS.
- **Events, audit log, and in-app notifications**: every business action
  (RFQ posted, bid submitted, award, escrow milestone release, KYC decision,
  loan decision) emits a domain event (`src/core/events/`) that's persisted
  to an append-only `domain_events` table, written to `audit_logs`, and
  fanned out to the recipients' in-app `notifications` — see
  [Architecture](#architecture) below.

AI modules (MarketAI/BidSense, ComplianceAI/SupplierRadar, RouteAI/RouteIQ,
CreditAI/CreditLayer) are implemented as deterministic stubs in
`src/core/ai/` with the same interfaces a trained model would need — swap
the implementation without touching callers. The wider v2.0 vision (TradeAI,
PriceAI, FraudAI, DocumentAI, Admin Console, wallet/ledger,
contracts/negotiation, chat) is schema-ready (see `src/db/schema/`) but not
yet wired up to any UI/API — see
[docs/02-product-requirements.md](./docs/02-product-requirements.md) for the
phased plan.

## Getting Started

1. Start Postgres 16+ and set `DATABASE_URL`/`APP_DATABASE_URL` in `.env`
   (copy `.env.example`) — see [Two database connections](#two-database-connections)
   for why there are two.
2. Install dependencies, migrate, and seed reference data:

   ```bash
   npm install
   npm run db:migrate     # applies the Drizzle-generated table migrations
   npm run db:bootstrap   # applies drizzle/manual/*.sql: roles, auth.uid(), RLS policies
   npm run db:seed        # reference data: countries, HS codes, tariffs, compliance docs
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). Check readiness anytime
at [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Or run everything via Docker Compose

```bash
cp .env.example .env   # set a real AUTH_JWT_SECRET
docker compose up --build
```

This starts Postgres, a one-shot `migrate` job (table migrations + RLS
bootstrap), and the app — no local Node or Postgres install needed.

## Data model

See `src/db/schema/*.ts` for the full schema, organized by domain: identity
(`profiles`, `organizations`, `organization_members`, `roles`, `permissions`,
`invitations`, `audit_logs`, `sts_score_logs`), trade reference (`countries`,
`hs_codes`, `tariffs`, `compliance_documents`), marketplace (`rfqs`, `bids`,
`negotiations`, `contracts`), logistics (`shipments`, `shipment_tracking`,
`freight_quotes`, `containers`), finance (`escrow_accounts`,
`escrow_milestones`, `trade_loans`, `invoices`, `payments`, `wallets`,
`transactions`), plus AI and notifications domains that exist in schema but
have no live routes yet. `scripts/seed.ts` populates trade reference data for
the 5 launch zones.

`organizations.type` includes `FREIGHT_FORWARDER`, `CUSTOMS_BROKER`,
`WAREHOUSE_PROVIDER`, `INSURANCE_PROVIDER`, and `FINANCE_PARTNER` alongside
the live `EXPORTER`/`IMPORTER` types — schema-ready for those ecosystem
actors, but no registration flow or dashboard exists for them yet.

`documents.type` covers the full trade document set from the vision doc
(Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading,
Air Waybill, Export/Import Declaration, Insurance/Inspection/Fumigation
Certificates, Letter of Credit, Proforma Invoice), though document
generation (DocAI) is not yet wired up to produce them.

## Production hardening

- **Validation**: every route parses its input with `zod`; malformed
  requests get a structured 400 rather than reaching business logic.
- **Centralized error handling**: `src/lib/api-handler.ts`'s `withApiHandler`
  wraps every route — Zod errors → 400, thrown `AppError` → its status code,
  anything else → 500 with internals hidden in production and reported to
  Sentry.
- **Structured logging**: `pino` (`src/lib/logger.ts`), one JSON line per
  request with request ID, status, and latency.
- **Rate limiting**: `src/lib/rate-limit.ts`, applied to registration, login,
  and the public compliance-checker endpoint. In-memory and per-process by
  design — swap in a shared store (e.g. `@upstash/ratelimit` on Redis) before
  running more than one app instance.
- **Security headers**: CSP, HSTS, X-Frame-Options, etc. in `next.config.mjs`.
- **Environment validation**: `src/lib/env.ts` validates `process.env` with
  zod at startup — a missing/malformed var fails fast with a clear message
  instead of surfacing as a confusing runtime error later.
- **`server-only` boundaries**: every module touching the database directly
  is marked with the `server-only` package, so accidentally importing DB
  code into a Client Component fails the build immediately instead of
  silently bloating (or breaking) the client bundle.
- **Tests + CI**: `npm test` (Vitest) runs unit tests for the pure
  scoring/compliance/logistics/credit logic and an integration test that
  exercises the full RFQ lifecycle through the real route handlers against a
  real, disposable Postgres database. GitHub Actions (`.github/workflows/ci.yml`)
  runs a Postgres service container, lint, typecheck (app + tests), migrate +
  bootstrap, test, and build on every push/PR.
- **Observability**: `@sentry/nextjs`, gated on `SENTRY_DSN` being set (inert
  otherwise — no network calls, no noise, in dev or in a deployment without
  Sentry configured). `/api/health` reports real Postgres connectivity for
  load balancer / orchestrator health checks.
- **Containerization**: multi-stage `Dockerfile` (Next.js `output: standalone`)
  and `docker-compose.yml` (Postgres + a one-shot migrate job + the app).

### Row Level Security

Every tenant-scoped table has RLS enabled — see
[docs/04-database-design.md#row-level-security](./docs/04-database-design.md#row-level-security)
for the full policy design. Application-layer authorization checks (e.g. "only
the RFQ's importer can award a bid") remain the primary gate in route
handlers; RLS is the defense-in-depth floor that would still deny a request
even if an application check were ever missed.

### Two database connections

`src/db/client.ts` exports two Drizzle instances:

- `serviceDb` — connects as the Postgres superuser via `DATABASE_URL`,
  bypasses RLS entirely. Used by migrations, `scripts/seed.ts`, and
  currently by all route handlers (mirroring how the Phase 1 Mongoose
  routes performed authorization checks purely in application code — RLS
  here is additive defense-in-depth, not yet the primary enforcement path
  for authenticated requests).
- `withRlsContext(profileId, fn)` — runs `fn` against the non-superuser
  `app_user` role via `APP_DATABASE_URL`, with `request.jwt.claims` set for
  the duration of one transaction so `auth.uid()` resolves inside RLS
  policies, exactly like a PostgREST-fronted setup would — but this is
  plain self-hosted Postgres, no PostgREST/Supabase involved.

### Auth: plain Postgres, no Supabase

SeaSharp does not use Supabase — not for Auth, not for hosted Postgres, not
for Storage. `DATABASE_URL`/`APP_DATABASE_URL` point at any Postgres
instance you run yourself (see `docker-compose.yml`), and
`src/core/identity/adapter.ts` owns identity end to end: `auth.users` is a
plain table this repo writes to directly, passwords are bcrypt-hashed, and
sessions are a signed JWT cookie verified locally with zero external calls.
`drizzle/manual/01_rls_and_roles.sql` provisions the
`anon`/`authenticated`/`service_role` roles and the `auth.uid()` helper
itself (a real Supabase project would provision these automatically; here
they're hand-rolled so RLS still works against a self-hosted database).

## Testing

```bash
npm test          # run once
npm run test:watch
```

- `tests/unit/` — pure functions (STS scoring, landed cost, credit scoring,
  route recommendation). No database needed.
- `tests/integration/` — the full RFQ lifecycle (register → post RFQ → bid →
  award → escrow milestones → STS recalculation → PO financing) invoked
  directly through the real Next.js route handlers, with `@/lib/session`
  mocked (no real cookie-based auth) and Postgres queries running for real.
  `tests/global-setup.ts` creates and migrates a disposable `..._test`
  database on the same Postgres server so the suite's per-test truncation
  never touches dev data.

## Not yet implemented

- Full workflows for Freight Forwarder, Customs Broker, Warehouse Provider,
  and Finance Partner organization types (schema-ready, no UI/API yet).
- Notification Center, Activity Center, Admin Console, wallet/ledger,
  contracts/digital signature, negotiation/counter-offers, chat — all
  schema-ready (`src/db/schema/`) per the v2.0 docs, no live routes yet.
- Document generation (DocAI) for the expanded document type set.
- Live freight API integration (Flexport/Freightos) — static cost estimates
  only for now.
- Real payment rails for escrow (Stripe) — escrow is modeled and enforced at
  the data layer but no live payment processor is wired in.
- RiskAI, PriceAI, MarketAI, and trained ML models behind the existing stubs
  (currently deterministic, by design).
- Distributed rate limiting (currently in-memory/per-process — fine for one
  instance, needs a shared store behind a load balancer).
- Object storage beyond the local-disk KYC/KYB upload stand-in
  (`src/core/storage/local-storage.ts`) — no signed URLs, bucket policies,
  or CDN. Realtime updates are polling-based (`CountdownTimer`), not a push
  channel.
