# SeaSharp — The Global Trade Infrastructure Platform

> **Docs**: see [`docs/`](./docs/README.md) for the full v2.0 product/technical
> "constitution" (vision, PRD, architecture, database design, design system,
> API spec) that this Phase 1 MVP is the foundation for.

Phase 1 MVP implementation of the SeaSharp product vision: an RFQ marketplace,
compliance/trade-route intelligence, logistics estimation, and PO-backed trade
finance in one closed-loop platform, built as the foundation for a broader
global trade ecosystem (freight forwarders, customs brokers, warehouse
providers, banks, and insurers).

Built to a production-hardening bar: MongoDB with replica-set transactions,
centralized validation/error-handling/logging, rate limiting, security
headers, automated tests + CI, error tracking, a health endpoint, and Docker
packaging. See [Production hardening](#production-hardening) below.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- MongoDB via Mongoose (multi-document transactions on a replica set)
- NextAuth (Credentials) for role-based auth (Exporter / Importer live today;
  Freight Forwarder / Customs Broker / Warehouse Provider / Bank / Insurance
  Company exist in the data model for later phases — see below)
- Zustand for live client state (auction countdowns)
- Vitest (unit + integration), GitHub Actions CI
- Sentry (`@sentry/nextjs`), pino structured logging
- Docker / docker-compose

## What's implemented (Phase 1 roadmap)

- **Trade Intelligence**: HS code lookup, tariff calculator, landed cost
  calculator, and document checklist for 5 launch trade zones (India, UAE,
  USA, EU, China), exposed as a public "Free Compliance Checker" (the GTM
  viral wedge) at `/compliance-checker`.
- **RFQ Marketplace**: RFQ posting, blind bidding (exporters never see
  competitors' prices), bid award, and escrow with milestone-gated fund
  release at `/marketplace`.
- **Logistics**: a RouteIQ-stub freight recommendation (mode + cost estimate)
  generated automatically when a bid is awarded.
- **Trade Finance**: PO-backed trade finance requests scored by a
  CreditLayer stub keyed off the exporter's SeaSharp Trust Score.
- **SeaSharp Trust Score (STS)**: composite 0–1000 score (KYC, on-time
  delivery, escrow speed, dispute rate, loan repayment) recalculated after
  every fulfilled trade — pure logic in `src/lib/sts.ts`, DB-backed
  persistence in `src/lib/sts-server.ts`.
- **KYC/KYB**: a SupplierRadar-stub check (`src/lib/supplierradar.ts`) gates
  verification status, which feeds into STS.

AI modules (BidSense, SupplierRadar, DocAI, RouteIQ, CreditLayer) are
implemented as deterministic stubs in `src/lib/` with the same interfaces a
trained model would need — swap the implementation without touching callers.
The wider AI Platform vision (RiskAI, PriceAI, MarketAI) is not yet built.

## Getting Started

1. Start MongoDB as a **replica set** (required for the transactions the
   escrow/award flow depends on — see [Data integrity](#data-integrity-transactions)
   below) and set `MONGODB_URI` in `.env` (copy `.env.example`).
2. Install dependencies and seed reference data:

   ```bash
   npm install
   npm run db:seed
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). Check readiness anytime
at [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Or run everything via Docker Compose

```bash
cp .env.example .env   # set a real NEXTAUTH_SECRET
docker compose up --build
```

This starts MongoDB as a single-node replica set (auto-initiated by the
`mongo` service's healthcheck) and the app, wired together — no local Node or
MongoDB install needed.

## Data model

See `src/models/` for the full schema: `User`, `Rfq`, `Bid`,
`Escrow` (with embedded milestones), `Shipment`, `LogisticsRoute`,
`TradeLoan`, `StsScoreLog`, plus the trade-reference collections `Country`,
`HsCode`, `TariffRule`, and `ComplianceDocument`. `scripts/seed.ts` populates
the reference data for the 5 launch zones.

`Role` includes `FREIGHT_FORWARDER`, `CUSTOMS_BROKER`, `WAREHOUSE_PROVIDER`,
`BANK`, and `INSURANCE_COMPANY` alongside the live `EXPORTER`/`IMPORTER`
roles — added so the schema is ready for those ecosystem actors, but no
registration flow or dashboard exists for them yet.

`DocumentType` covers the full trade document set from the vision doc
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
- **Structured logging**: `pino` (`src/lib/logger.ts`), one line per request
  with request ID, status, and latency; pretty-printed in dev, JSON in prod.
- **Rate limiting**: `src/lib/rate-limit.ts`, applied to registration, login,
  and the public compliance-checker endpoint. In-memory and per-process by
  design — swap in a shared store (e.g. `@upstash/ratelimit` on Redis) before
  running more than one app instance.
- **Security headers**: CSP, HSTS, X-Frame-Options, etc. in `next.config.mjs`.
- **Environment validation**: `src/lib/env.ts` validates `process.env` with
  zod at startup — a missing/malformed var fails fast with a clear message
  instead of surfacing as a confusing runtime error later.
- **`server-only` boundaries**: every module touching Mongoose/MongoDB is
  marked with the `server-only` package, so accidentally importing DB code
  into a Client Component fails the build immediately instead of silently
  bloating (or breaking) the client bundle.
- **Tests + CI**: `npm test` (Vitest) runs unit tests for the pure
  scoring/compliance/logistics/credit logic and an integration test that
  exercises the full RFQ lifecycle through the real route handlers. GitHub
  Actions (`.github/workflows/ci.yml`) runs lint, typecheck (app + tests),
  test, and build on every push/PR.
- **Observability**: `@sentry/nextjs`, gated on `SENTRY_DSN` being set (inert
  otherwise — no network calls, no noise, in dev or in a deployment without
  Sentry configured). `/api/health` reports real MongoDB connectivity for
  load balancer / orchestrator health checks.
- **Containerization**: multi-stage `Dockerfile` (Next.js `output: standalone`)
  and `docker-compose.yml` (app + MongoDB replica set).

### Data integrity (transactions)

Escrow award (`/api/rfqs/[id]/award`) and milestone release
(`/api/escrow/[id]/release`) each touch multiple collections atomically
(RFQ status, bid status, escrow + embedded milestones, shipment) using a
Mongoose `session.withTransaction()`. This requires MongoDB to be running as
a **replica set** — a plain standalone `mongod` does not support
multi-document transactions. `docker-compose.yml` and any real MongoDB
Atlas/replica-set deployment satisfy this; a bare `mongod --dbpath ...` with
no `--replSet` flag does not.

> **Note on local development in constrained/offline environments**: this
> repo's own dev loop was built inside a sandboxed CI-like environment that
> couldn't download the real `mongod` binary (network egress to
> `mongodb.org`/Docker Hub was blocked). We validated everything possible
> against [FerretDB](https://www.ferretdb.com/) (a MongoDB-wire-protocol
> server) as a local stand-in, and confirmed via automated tests that the
> real transactional paths run correctly wherever multi-document
> transactions are actually available (GitHub Actions CI, via
> `mongodb-memory-server`, and any real MongoDB deployment). FerretDB itself
> doesn't implement transactions, so those specific code paths are skipped
> with a clear message when run against it — see `tests/db.ts`'s
> `transactionsSupported()` helper and its use in
> `tests/integration/rfq-lifecycle.test.ts`. This is purely a note about how
> this repo was developed, not a requirement for using it — a normal
> `docker compose up` or MongoDB Atlas connection has full transaction
> support and needs none of this.

## Testing

```bash
npm test          # run once
npm run test:watch
```

- `tests/unit/` — pure functions (STS scoring, landed cost, credit scoring,
  route recommendation). No database needed.
- `tests/integration/` — the full RFQ lifecycle (register → post RFQ → bid →
  award → escrow milestones → STS recalculation → PO financing) invoked
  directly through the real Next.js route handlers, with `next-auth`'s
  session mocked. Spins up `mongodb-memory-server` automatically if
  `MONGODB_URI` isn't already set in the environment.

## Not yet implemented (later phases per the roadmap)

- Full workflows for Freight Forwarder, Customs Broker, Warehouse Provider,
  Bank, and Insurance Company roles (schema-ready, no UI/API yet).
- Document generation (DocAI) for the expanded `DocumentType` set.
- Live freight API integration (Flexport/Freightos) — Phase 1 ships static
  cost estimates only.
- Real payment rails for escrow (Stripe) — escrow is modeled and enforced at
  the data layer but no live payment processor is wired in.
- Admin console for KYC review / dispute resolution / marketplace moderation.
- RiskAI, PriceAI, MarketAI, and trained ML models behind the existing stubs
  (currently deterministic, by design, per Phase 1 scope).
- Distributed rate limiting (currently in-memory/per-process — fine for one
  instance, needs a shared store behind a load balancer).
