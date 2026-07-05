# TradeNova — The Trade Operating System

Phase 1 MVP implementation of the TradeNova product vision: an RFQ marketplace,
compliance/trade-route intelligence, logistics estimation, and PO-backed trade
finance in one closed-loop platform.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL via Prisma
- NextAuth (Credentials) for role-based auth (Exporter / Importer)
- Zustand for live client state (auction countdowns)

## What's implemented (Phase 1 roadmap)

- **Pillar A — Intelligence Layer**: HS code lookup, tariff calculator, landed
  cost calculator, and document checklist for 5 launch trade zones (India,
  UAE, USA, EU, China), exposed as a public "Free Compliance Checker" (the
  GTM viral wedge) at `/compliance-checker`.
- **Pillar B — Marketplace Layer**: RFQ posting, blind bidding (exporters
  never see competitors' prices), bid award, and escrow with milestone-gated
  fund release at `/marketplace`.
- **Pillar C — Logistics Layer**: a RouteIQ-stub freight recommendation
  (mode + cost estimate) generated automatically when a bid is awarded.
- **Pillar D — Finance Layer**: PO-backed trade finance requests scored by a
  CreditLayer stub keyed off the exporter's TradeNova Score.
- **TradeNova Score (TNS)**: composite 0–1000 score (KYC, on-time delivery,
  escrow speed, dispute rate, loan repayment) recalculated after every
  fulfilled trade — see `src/lib/tns.ts`.
- **KYC/KYB**: a SupplierRadar-stub check (`src/lib/supplierradar.ts`) gates
  verification status, which feeds into TNS.

AI modules (BidSense, SupplierRadar, DocAI, RouteIQ, CreditLayer) are
implemented as deterministic stubs in `src/lib/` with the same interfaces a
trained model would need — swap the implementation without touching callers.

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
`TnsScoreLog`, plus the trade-reference tables `Country`, `HsCode`,
`TariffRule`, and `ComplianceDocument`. `prisma/seed.ts` populates the
reference data for the 5 launch zones.

## Not yet implemented (later phases per the roadmap)

- Live freight API integration (Flexport/Freightos) — Phase 1 ships static
  cost estimates only.
- Real payment rails for escrow (Stripe) — escrow is modeled and enforced at
  the data layer but no live payment processor is wired in.
- Admin console for KYC review / dispute resolution.
- Trained ML models behind BidSense / SupplierRadar / DocAI / RouteIQ /
  CreditLayer (currently deterministic stubs, by design, per Phase 1 scope).
