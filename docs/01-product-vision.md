# SeaSharp Product Vision

> Status: v2.0 target architecture. See [docs/README.md](./README.md) for how
> this compares to what's actually shipped today.

## Positioning

**SeaSharp — The Global Trade Infrastructure Platform.**

Not just an export/import platform. Not just a marketplace. Not just
logistics. SeaSharp is the operating system for global trade: the single
place an SME exporter or importer manages identity, sourcing, financing,
logistics, and compliance across a shipment's entire lifecycle, instead of
stitching together email threads, spreadsheets, freight forwarders, and bank
branches.

## Problem

Global trade is a $32T/year market still coordinated primarily through email.
SME exporters and importers — the vast majority of trade participants — lack:

- A trustworthy way to discover verified counterparties.
- Payment protection that doesn't require a pre-existing banking relationship.
- Visibility into shipment status once cargo leaves the warehouse.
- Access to working capital gated by anything other than years of banking
  history and physical collateral.
- A single system of record — today it's spread across email, PDFs, and
  phone calls with four or five different intermediaries.

## Solution: Six Infrastructure Layers

SeaSharp is architected as six layers, each independently valuable and
compounding together as a closed loop:

1. **Identity & Organization** — every actor (exporter, importer, freight
   forwarder, customs broker, warehouse provider, insurer, finance partner,
   investor) gets a verifiable identity and an organization they can invite
   teammates into.
2. **Trade Intelligence** — HS code lookup, tariffs, landed cost, compliance
   rules, sanctions, and required certificates, free and instant.
3. **Marketplace** — reverse-auction RFQs with blind bidding, negotiation,
   contracts, and digital signature connect verified buyers and sellers.
4. **Logistics** — warehouse-to-warehouse tracking across pickup, port,
   customs, carrier, and final-mile delivery.
5. **Finance** — escrow, PO/invoice financing, wallets, and an investor
   marketplace turn a completed trade into fundable, trackable cash flow.
6. **Intelligence & AI** — a family of AI services (TradeAI, ComplianceAI,
   RouteAI, SupplierRadar, RiskAI, CreditLayer, PriceAI, MarketAI, DocAI,
   FraudAI) makes every layer self-improving as transaction volume grows.

Each layer stands alone as a usable product. Together, they form a loop where
every transaction feeds the next: a completed shipment improves an exporter's
SeaSharp Trust Score (STS), which unlocks better financing rates and bid
visibility, which drives more transactions.

## Who it's for

| Role | Status |
|---|---|
| Exporter | Core, live from Phase 1 |
| Importer | Core, live from Phase 1 |
| Freight Forwarder | Ecosystem role, Phase 2+ |
| Customs Broker | Ecosystem role, Phase 2+ |
| Warehouse Provider | Ecosystem role, Phase 2+ |
| Insurance Provider | Ecosystem role, Phase 3+ |
| Finance Partner / Investor | Ecosystem role, Phase 3+ |
| Admin / Super Admin | Internal, Phase 1+ (console lands Phase 5) |

## Trust as a product feature

Every organization on SeaSharp accumulates a public **company profile**:
verification badge, certifications, trade history, warehouses, products, and
a **SeaSharp Trust Score (STS)** — a composite 0–1000 score built from KYC
status, delivery success, payment history, compliance accuracy, dispute
history, and (once live) customer reviews. STS isn't cosmetic: it directly
gates bid visibility and trade-finance interest rates, so trust compounds
into real economic advantage for good actors.

## Revenue model

Three revenue streams from a single transaction: escrow processing fees,
logistics commissions, and trade finance commissions — plus longer-term SaaS
subscriptions, insurance partnerships, verification services, enterprise API
subscriptions, and premium analytics. SeaSharp only earns when a deal actually
moves.

## Roadmap

### Phase 1 — Foundation
Authentication, Organizations, Trade Intelligence, Dashboard, Country Data,
HS Codes, Tariff Engine.

### Phase 2 — Operations
RFQ Marketplace, Logistics, Documents, Notifications.

### Phase 3 — Finance
Escrow, Trade Finance, Wallet, Payments.

### Phase 4 — Intelligence
AI Modules, Fraud Detection, Analytics, API Platform.

### Phase 5 — Enterprise
ERP Integrations, Government Integrations, White-label Solutions, Global
Expansion.

Each phase funds and unlocks the next: Phase 1's free Trade Intelligence
tools are the acquisition wedge; Phase 2's Marketplace and Logistics create
transaction volume; Phase 3's Finance layer monetizes that volume; Phase 4's
Intelligence layer compounds the platform's data advantage; Phase 5 scales it
into infrastructure other platforms integrate against.

## What "done" looks like for v2.0

A company can sign up, form an organization, invite teammates with scoped
roles, get verified, post or bid on an RFQ, negotiate and sign a contract,
track the shipment door-to-door, move payment through escrow or trade
finance, and see all of it — documents, messages, milestones, money — in one
activity feed. No email required.
