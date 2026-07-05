# SeaSharp — The Global Trade Infrastructure Platform

Phase 1 MVP implementation of the SeaSharp product vision: an RFQ marketplace,
compliance/trade-route intelligence, logistics estimation, and PO-backed trade
finance in one closed-loop platform, built as the foundation for a broader
global trade ecosystem (freight forwarders, customs brokers, warehouse
providers, banks, and insurers).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL via Prisma
- NextAuth (Credentials) for role-based auth (Exporter / Importer live today;
  Freight Forwarder / Customs Broker / Warehouse Provider / Bank / Insurance
  Company exist in the data model for later phases — see below)
- Zustand for live client state (auction countdowns)

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
  every fulfilled trade — see `src/lib/sts.ts`.
- **KYC/KYB**: a SupplierRadar-stub check (`src/lib/supplierradar.ts`) gates
  verification status, which feeds into STS.

AI modules (BidSense, SupplierRadar, DocAI, RouteIQ, CreditLayer) are
implemented as deterministic stubs in `src/lib/` with the same interfaces a
trained model would need — swap the implementation without touching callers.
The wider AI Platform vision (RiskAI, PriceAI, MarketAI) is not yet built.

## Getting Started

1. Start PostgreSQL and set `DATABASE_URL` in `.env` (copy `.env.example`).
2. Install dependencies and set up the database:

   ```bash
   npm install
   npx prisma migrate dev
   npm run db:seed
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Data model

See `prisma/schema.prisma` for the full model: `User`, `Rfq`, `Bid`,
`Escrow`/`EscrowMilestone`, `Shipment`, `LogisticsRoute`, `TradeLoan`,
`StsScoreLog`, plus the trade-reference tables `Country`, `HsCode`,
`TariffRule`, and `ComplianceDocument`. `prisma/seed.ts` populates the
reference data for the 5 launch zones.

`Role` includes `FREIGHT_FORWARDER`, `CUSTOMS_BROKER`, `WAREHOUSE_PROVIDER`,
`BANK`, and `INSURANCE_COMPANY` alongside the live `EXPORTER`/`IMPORTER`
roles — added so the schema is ready for those ecosystem actors, but no
registration flow or dashboard exists for them yet.

`DocumentType` covers the full trade document set from the vision doc
(Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading,
Air Waybill, Export/Import Declaration, Insurance/Inspection/Fumigation
Certificates, Letter of Credit, Proforma Invoice), though document
generation (DocAI) is not yet wired up to produce them.

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
