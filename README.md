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

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS, `framer-motion`
- **Postgres via Drizzle ORM**, with real Row Level Security — see
  [Row Level Security](#row-level-security) below
- A local Supabase-Auth-compatible auth adapter (`src/lib/auth/`) — signs
  JWT session cookies, writes to an `auth.users` table shaped exactly like
  Supabase's GoTrue would, so swapping in real Supabase Auth later only
  touches that one module, not any caller (see
  [Why not real Supabase](#why-not-real-supabase-here) below)
- Organizations + RBAC (`organizations`, `organization_members`, `roles`,
  `permissions`) — every registered account gets its own organization; the
  exporter/importer distinction from earlier phases is now the
  organization's `type`
- Vitest (unit + integration against a real disposable Postgres database),
  GitHub Actions CI (with a Postgres service container)
- Sentry (`@sentry/nextjs`), pino structured logging
- Docker / docker-compose

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
  every fulfilled trade — pure logic in `src/lib/sts.ts`, DB-backed
  persistence in `src/lib/sts-server.ts`.
- **KYC/KYB**: a SupplierRadar-stub check (`src/lib/supplierradar.ts`) gates
  an organization's verification status, which feeds into STS.

AI modules (BidSense, SupplierRadar, DocAI, RouteIQ, CreditLayer) are
implemented as deterministic stubs in `src/lib/` with the same interfaces a
trained model would need — swap the implementation without touching callers.
The wider v2.0 vision (Notification Center, Activity Center, Admin Console,
RiskAI/PriceAI/MarketAI, wallet/ledger, contracts/negotiation, chat) is
schema-ready (see `src/db/schema/`) but not yet wired up to any UI/API — see
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
  policies exactly like it would under real Supabase/PostgREST.

### Why not real Supabase here?

This repo's own dev loop runs inside a sandboxed environment that can't run
Docker containers (no privileged mode / no systemd), which rules out
self-hosting Supabase's full stack (GoTrue, PostgREST, Realtime, Storage all
ship as separate containers). Against a **real Supabase project**, none of
`drizzle/manual/01_rls_and_roles.sql`'s role/`auth.uid()` bootstrap is
needed — Supabase already provisions `anon`/`authenticated`/`service_role`
and PostgREST already sets `request.jwt.claims` per request. Swapping in
real Supabase Auth means: pointing `DATABASE_URL` at the Supabase Postgres
connection string, dropping the local `auth.users` population from
`src/lib/auth/register.ts` in favor of the real `supabase.auth.signUp()`
call, and removing `drizzle/manual/01_rls_and_roles.sql`'s role-provisioning
statements (keeping only the RLS policies themselves, which are
plain portable SQL).

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
- Real Supabase Auth/Storage/Realtime (see
  [Why not real Supabase here](#why-not-real-supabase-here) above).
