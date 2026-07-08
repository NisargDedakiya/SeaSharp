# SeaSharp Product Requirements Document (PRD)

> Status: v2.0 target architecture. See [docs/README.md](./README.md) for how
> this compares to what's actually shipped today.

This document specifies every feature by layer, its user flow, and its
acceptance criteria. Scope per phase follows the roadmap in the
[Product Vision](./01-product-vision.md#roadmap).

---

## Layer 1 — Identity & Organization *(Phase 1)*

### 1.1 Authentication
- **Flow**: user signs up with email + password (Supabase Auth), verifies
  email, signs in, session persists across visits.
- **Acceptance criteria**: unverified emails cannot access authenticated
  routes; passwords meet a minimum strength policy; failed logins are rate
  limited; sessions expire and refresh silently.
- Multi-factor authentication is scoped for a later phase, not Phase 1.

### 1.2 Organizations, Teams, Members
- **Flow**: on first sign-in, a user creates or joins an organization. An
  organization has one or more teams/departments. Org owners invite members
  by email; invitees land directly in the right org with a pre-assigned role.
- **Acceptance criteria**: every authenticated action is scoped to an
  organization; a user can belong to multiple organizations and switch
  between them; an invitation expires after 7 days and is single-use.

### 1.3 Role-Based Access Control (RBAC)
- **Flow**: org owners assign roles (e.g. Admin, Member, Billing) to members;
  permissions are checked server-side on every request, never trusted from
  the client.
- **Acceptance criteria**: a permission matrix maps role → allowed actions;
  removing a role immediately revokes access (no stale sessions with elevated
  rights); attempts at unauthorized actions return 403 and are audit-logged.

### 1.4 Company Verification (KYC/KYB)
- **Flow**: an organization submits registration documents, tax ID, and
  beneficial-ownership info; SupplierRadar/ComplianceAI flags anomalies;
  an admin (or automated pipeline) approves/rejects.
- **Acceptance criteria**: verification status is one of
  `UNVERIFIED | PENDING | VERIFIED | REJECTED`; a `VERIFIED` badge appears on
  the public company profile; verification state feeds the STS calculation.

### 1.5 Audit Logs
- **Flow**: every state-changing action (login, document upload, escrow
  release, role change) is appended to an immutable audit log, visible to
  org admins in the Activity Center.
- **Acceptance criteria**: audit entries are append-only (no update/delete
  path in the API); each entry records actor, action, target, and timestamp.

---

## Layer 2 — Trade Intelligence *(Phase 1)*

### 2.1 HS Code Search & Tariff Engine
- **Flow**: user searches by product keyword or HS code; results show
  applicable tariff rate for a given origin/destination pair.
- **Acceptance criteria**: search returns results in under 300ms for the
  seeded reference set; tariff lookups are correct for all launch trade
  zones.

### 2.2 Landed Cost Calculator
- **Flow**: user enters product, volume, unit price, origin, destination;
  the calculator returns tariff, estimated freight, and total landed cost.
- **Acceptance criteria**: output breaks down each cost component; result is
  shareable via a stable URL.

### 2.3 Compliance Checker (public, unauthenticated)
- **Flow**: a visitor enters a product + trade lane and receives a document
  checklist and compliance summary — no login required (this is the GTM
  acquisition wedge).
- **Acceptance criteria**: usable without an account; rate-limited to prevent
  abuse; captures an optional email for follow-up.

### 2.4 Country Rules, Trade Agreements (FTA), Incoterms Guide
- **Acceptance criteria**: each of the 5 launch countries has rule data,
  applicable FTAs, and an Incoterms reference usable from both the
  Compliance Checker and RFQ creation flow.

### 2.5 Sanctions & Restricted Products Checker
- **Flow**: RFQ/product submission is checked against a restricted/sanctioned
  list before it can be posted.
- **Acceptance criteria**: a match blocks submission with a clear reason;
  false positives can be appealed to an admin.

---

## Layer 3 — Marketplace *(Phase 2)*

### 3.1 RFQ Marketplace & Reverse Auction
- **Flow**: importer posts an RFQ (product, volume, target price, deadline);
  verified exporters submit blind bids; importer awards the best bid.
- **Acceptance criteria**: exporters never see competitors' bid prices before
  award; an RFQ cannot be awarded past its deadline unless explicitly
  extended; award is atomic (exactly one bid wins, RFQ and bid status update
  together).

### 3.2 Counter-Offers & Negotiation
- **Flow**: after an initial bid, either party can propose a counter-offer
  with a message; a negotiation thread tracks the back-and-forth until
  acceptance or withdrawal.
- **Acceptance criteria**: every counter-offer is versioned (never silently
  overwritten); both parties can view full negotiation history.

### 3.3 Contracts & Digital Signature
- **Flow**: upon award, a contract is generated from the agreed terms; both
  parties sign digitally before escrow funding unlocks.
- **Acceptance criteria**: a contract is immutable once fully signed; partial
  signatures block escrow funding; signed contracts are downloadable as PDF.

### 3.4 Supplier/Buyer Discovery
- **Flow**: users browse or search verified company profiles by product
  category, country, and trust tier, independent of an open RFQ.
- **Acceptance criteria**: discovery results respect verification and
  visibility settings; STS tier affects default sort order.

### 3.5 Chat & File Sharing
- **Flow**: once two parties are matched on an RFQ, a scoped chat thread
  opens with file attachments.
- **Acceptance criteria**: chat is scoped to the RFQ/negotiation (no
  unsolicited cross-org messaging); attachments go through the same
  document-scanning pipeline as formal trade documents.

---

## Layer 4 — Logistics *(Phase 2)*

### 4.1 Shipment Flow
Supplier Warehouse → Pickup → Port → Export Customs → Sea/Air → Import
Customs → Destination Port → Truck → Importer Warehouse.

- **Acceptance criteria**: each shipment exposes its current milestone from
  this fixed sequence; milestones only move forward, never backward, without
  an explicit dispute/correction flow.

### 4.2 Pickup Requests, Warehouse Management, Transport Booking
- **Acceptance criteria**: a pickup request references a specific shipment
  and warehouse; booking a carrier locks in a freight quote.

### 4.3 Freight Quotes & Container Tracking
- **Acceptance criteria**: quotes carry an expiry; container tracking numbers
  are validated against the carrier's expected format before saving.

### 4.4 Customs Milestones, ETA Prediction, Delivery Confirmation
- **Acceptance criteria**: delivery confirmation requires an explicit
  importer acknowledgment (not just a carrier status update) before escrow's
  final milestone can release.

### 4.5 GPS Tracking *(future, not scoped for Phase 2)*

---

## Layer 5 — Finance *(Phase 3)*

### 5.1 Escrow
- **Flow**: awarded RFQ funds move into an escrow account with named
  milestones; each milestone release requires the corresponding shipment
  milestone to be confirmed.
- **Acceptance criteria**: funds cannot release out of milestone order;
  escrow state transitions are transactional (no partial-release states).

### 5.2 PO Financing & Invoice Financing
- **Flow**: an exporter with an awarded RFQ (and funded escrow) can request
  financing against the purchase order; CreditLayer scores the request using
  STS, delivery history, and commodity volatility.
- **Acceptance criteria**: financing terms (rate, amount) are computed from a
  documented, versioned scoring model; defaults are recorded and feed back
  into STS.

### 5.3 Wallet, Ledger, Currency Conversion
- **Acceptance criteria**: every wallet balance change has a corresponding
  ledger entry (double-entry, immutable); currency conversion uses a rate
  source recorded at time of transaction for auditability.

### 5.4 Investor Marketplace
- **Flow**: accredited investors browse funded/fundable trade loans and
  commit capital.
- **Acceptance criteria**: investor-facing risk data matches the same
  CreditLayer score shown to the exporter (single source of truth).

### 5.5 Payments (Stripe)
- **Acceptance criteria**: payment webhooks are idempotent; a duplicate
  webhook delivery must not double-credit a wallet or escrow account.

---

## Layer 6 — Intelligence & AI *(Phase 4)*

Each AI service ships first as a deterministic, documented stub with the
exact interface a trained model would need, then is swapped for a real model
without touching callers — the same pattern already used for BidSense,
SupplierRadar, DocAI, RouteIQ, and CreditLayer in Phase 1.

| Service | Purpose | Acceptance criteria |
|---|---|---|
| TradeAI | General trade-pattern insights | Outputs are explainable (surfaces the factors behind a recommendation) |
| ComplianceAI | Flags compliance risk before submission | No false-negative on the seeded sanctions/restricted list |
| RouteAI | Freight route optimization | Recommendation includes cost + time tradeoff, not just one number |
| SupplierRadar | OSINT-based supplier vetting | Flags are sourced (shows what triggered them), never a black-box score alone |
| RiskAI | Standalone fraud detection | Runs asynchronously; never blocks a user-facing action |
| CreditLayer | PO loan risk scoring | Score is reproducible given the same inputs (deterministic or seeded) |
| PriceAI | Freight price prediction | Confidence interval shown alongside point estimate |
| MarketAI | Buyer/demand-side matching | Recommendations are re-rankable by the user, not forced |
| DocAI | Document parsing/generation | Extraction accuracy is measured against a labeled test set before launch |
| FraudAI | Cross-cutting fraud signals | Every flag is reviewable by a human before any account action is taken |

---

## Cross-cutting features

### Notification Center *(Phase 2)*
Email, SMS, WhatsApp, push, and in-app notifications, with per-channel user
preferences. **Acceptance criteria**: a user can disable any channel except
security-critical alerts (password reset, login from new device).

### Activity Center *(Phase 2)*
Everything is logged and visible to the user: documents created, shipment
updates, escrow updates, login history, payments. **Acceptance criteria**:
activity feed is per-organization, filterable by type and date range.

### Company Profile *(Phase 1, expanded Phase 2)*
Verification badge, certifications, trade history, employees, warehouses,
products, STS. **Acceptance criteria**: profile is publicly viewable (minus
sensitive fields) without authentication, to support discovery.

### Widget-Based Dashboard *(v2.0 — Task 5/8)*
`/dashboard` renders a configurable grid of widgets instead of one fixed
layout per organization type: SeaSharp Trust Score, KYC/KYB, PO-Backed Trade
Finance, RFQs, Shipments, Revenue, Notifications, plus Calendar and Tasks
placeholders for domains not built yet. Each widget is independently
registered (`src/components/dashboard/widgets/registry.ts`) so adding a new
one never touches the page's layout logic. **Acceptance criteria**:
- Every non-placeholder widget (STS, KYC, Loan, RFQs, Shipments, Revenue,
  Notifications) renders real data from its owning domain table — no widget
  fabricates numbers it can't back with a query. Calendar and Tasks are
  explicitly labeled "coming soon" until a calendar/task domain exists.
- A user can show/hide and reorder widgets from the dashboard itself; the
  resulting layout persists per-profile-per-organization (`dashboard_layouts`
  table) and is restored on the next sign-in / session, not just for the
  current browser tab.
- A profile who has never customized their layout gets a sensible
  organization-type default (exporters see STS/KYC/Loan/Revenue; importers
  see RFQs first) rather than an empty dashboard.
- Hiding a widget never deletes its underlying data — toggling it back on
  immediately shows the same live data again.

### Admin Dashboard *(Phase 5, MVP subset earlier as needed)*
User/company/country/HS-code/tariff management, marketplace moderation,
shipment/escrow/finance/AI/security monitoring, audit logs, platform
analytics. **Acceptance criteria**: every admin action that affects a user's
data is itself audit-logged.

### Public Website
Home, Features, Solutions, Industries, Pricing, Marketplace, Resources, Blog,
Documentation, API, About, Contact, Support, Status. **Acceptance criteria**:
Status page reflects real uptime data, not a static "all systems operational."
