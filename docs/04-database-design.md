# SeaSharp Database Design

> Status: this schema is live — see `src/db/schema/*.ts` for the actual
> Drizzle definitions and `drizzle/manual/01_rls_and_roles.sql` for the RLS
> policies. A few tables differ slightly from this doc's original sketch for
> Phase 1 feature-parity reasons (e.g. `tariffs.additional_fee_percent`,
> `shipments`' richer column set) — the code is the source of truth where
> the two disagree. See [docs/README.md](./README.md) for the full
> comparison against the target.

Database: **Supabase PostgreSQL**. ORM: **Drizzle** (`src/db/schema/*`, one
file per domain below). Every table has `id uuid primary key default
gen_random_uuid()`, `created_at timestamptz default now()`, and
`updated_at timestamptz default now()` unless noted otherwise.

## Conventions

- Foreign keys are `<table_singular>_id`, e.g. `organization_id`, `rfq_id`.
- Every domain table (i.e. not a pure reference table like `countries`)
  carries `organization_id` for multi-tenancy, even if it's derived
  transitively — this keeps RLS policies uniform instead of joining through
  three tables to find the tenant boundary.
- Enums are Postgres `enum` types, not free-text columns with
  application-level validation only — the database should reject an invalid
  status even if application code has a bug.
- Money columns are `numeric(14, 2)` (or `numeric(18, 6)` for anything
  crypto/FX-sensitive), never `float`/`double precision`.
- Soft deletes only where a record has a compliance/audit reason to persist
  (e.g. `organizations`, `documents`); everything else uses hard deletes with
  cascade rules made explicit per table below.

## Identity domain

### `profiles`
Extends Supabase Auth's `auth.users` with app-specific fields (1:1 on `id`).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | FK → `auth.users.id` |
| `full_name` | text | |
| `avatar_url` | text | Supabase Storage path in `user-avatars` |
| `phone` | text | |

### `organizations`
| Column | Type | Notes |
|---|---|---|
| `name` | text | |
| `slug` | text unique | for public profile URLs |
| `type` | enum | `exporter, importer, freight_forwarder, customs_broker, warehouse_provider, insurance_provider, finance_partner, investor` |
| `country` | text | ISO 3166-1 alpha-2, FK → `countries.code` |
| `kyc_status` | enum | `unverified, pending, verified, rejected` |
| `sts_score` | integer | denormalized cache of the latest STS calculation, recomputed by `ai_predictions`/scoring job |
| `deleted_at` | timestamptz nullable | soft delete |

### `organization_members`
| Column | Type | Notes |
|---|---|---|
| `organization_id` | uuid | FK → `organizations.id`, cascade delete |
| `profile_id` | uuid | FK → `profiles.id` |
| `role_id` | uuid | FK → `roles.id` |
| unique | | `(organization_id, profile_id)` |

### `invitations`
| Column | Type | Notes |
|---|---|---|
| `organization_id` | uuid | FK |
| `email` | text | |
| `role_id` | uuid | FK → `roles.id` |
| `token` | text unique | |
| `expires_at` | timestamptz | 7 days from creation |
| `accepted_at` | timestamptz nullable | |

### `roles` / `permissions`
Standard RBAC join: `roles(id, organization_id nullable, name)`,
`permissions(id, key)`, `role_permissions(role_id, permission_id)`.
`organization_id` nullable on `roles` allows a set of system default roles
(Owner, Admin, Member) alongside org-defined custom roles.

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `organization_id` | uuid | FK, indexed |
| `actor_id` | uuid | FK → `profiles.id`, nullable (system actions) |
| `action` | text | e.g. `escrow.release`, `member.role_changed` |
| `target_type` / `target_id` | text / uuid | polymorphic reference |
| `metadata` | jsonb | before/after values where relevant |

Append-only: no `UPDATE`/`DELETE` grants on this table for any application
role, enforced at the RLS/grant level, not just by convention.

## Trade reference domain

`countries`, `ports`, `hs_codes`, `tariffs`, `trade_rules`,
`restricted_products` — reference data, no `organization_id` (globally
shared, admin-managed). `warehouses` and `products` *do* carry
`organization_id` since they belong to a specific org.

Indexes: `hs_codes(code)`, `tariffs(hs_code, origin_country, destination_country)`
as a composite index — this is the hot path for the Landed Cost Calculator
and must stay index-only-scan fast.

## Marketplace domain

### `rfqs`
| Column | Type | Notes |
|---|---|---|
| `organization_id` | uuid | the importer org |
| `status` | enum | `open, awarded, cancelled, fulfilled` |
| `hs_code` | text | FK → `hs_codes.code` |
| `origin_country` / `destination_country` | text | FK → `countries.code` |
| `deadline` | timestamptz | |
| `awarded_bid_id` | uuid nullable | FK → `bids.id` |

### `rfq_items`
Line items when an RFQ covers multiple products/SKUs in one request —
`rfq_id, product_id, volume, unit, target_price_per_unit`.

### `bids`
`rfq_id, organization_id` (exporter org), `price_per_unit`, `message`,
`status enum (pending, accepted, rejected, withdrawn)`. Unique constraint on
`(rfq_id, organization_id)` — one active bid per org per RFQ (superseded by
`negotiations` for counter-offers, not a second row here).

### `negotiations`
`bid_id`, `proposed_by (organization_id)`, `price_per_unit`, `message`,
`sequence integer` — an append-only thread; the latest row per `bid_id`
is the current offer on the table.

### `contracts`
`rfq_id`, `bid_id`, `terms jsonb`, `importer_signed_at`, `exporter_signed_at`,
`document_id` (FK → `documents.id` for the generated/signed PDF). Immutable
once both signature timestamps are set — enforced by a trigger that rejects
updates to `terms` after that point.

## Logistics domain

### `shipments`
`rfq_id`, `organization_id` (exporter), `milestone enum` following the fixed
sequence: `pickup, port_export, export_customs, in_transit, import_customs,
port_import, final_delivery, delivered`. `milestone` only moves forward —
enforced by a check constraint comparing enum ordinal, not just application
logic.

### `shipment_tracking`
Append-only event log per shipment: `shipment_id, milestone, occurred_at,
source (carrier_api | manual | customs_feed), metadata jsonb`. `shipments.milestone`
is a denormalized "current state" pointer to the latest row here.

### `logistics_routes`, `carriers`, `freight_quotes`, `containers`
Standard reference/booking tables; `freight_quotes.expires_at` is enforced —
an expired quote cannot be booked (checked at the query layer and by a
`valid_until` check in the booking function).

## Finance domain

### `escrow_accounts`
`rfq_id`, `amount`, `currency`, `status enum (pending, funded, releasing,
released, disputed, refunded)`. Milestones live in a child table, not a
jsonb blob, so each milestone release is its own auditable row:

### `escrow_milestones`
`escrow_account_id`, `name`, `sequence integer`, `amount`, `status enum
(pending, ready, released)`, `released_at`, `shipment_milestone` (the
`shipments.milestone` value that must be reached before `status` can move to
`ready`).

### `invoices`, `payments`
Stripe-backed; `payments.stripe_event_id unique` — this is the idempotency
guard against duplicate webhook processing.

### `wallets`, `transactions`
Double-entry: every `transactions` row has `wallet_id`, `amount` (signed),
`balance_after` (denormalized, recomputed and checked against a running sum
by a nightly reconciliation job — divergence pages an on-call, it never
silently "self-heals").

### `trade_loans`
`rfq_id`, `exporter_org_id`, `requested_amount`, `approved_amount`,
`interest_rate_percent`, `risk_band`, `status enum (requested, approved,
rejected, disbursed, repaying, repaid, defaulted)`.

## AI domain

`ai_predictions` (generic: `service_name, input jsonb, output jsonb,
confidence numeric, model_version text`), `ai_logs` (execution trace for
debugging/audit), `route_predictions`, `risk_scores` — all reference the
entity they scored (`target_type`, `target_id`) rather than one column per
domain, so adding a new AI service never requires a schema migration to a
core domain table.

## Notifications domain

`notifications` (`profile_id, type, payload jsonb, read_at nullable`),
`notification_preferences` (`profile_id, channel enum (email, sms, whatsapp,
push, in_app), notification_type, enabled boolean`). Security-critical
notification types (password reset, new-device login) ignore
`notification_preferences` — they always send, by design, not by bug.

## Files domain

`documents` (formal trade documents: `organization_id, type enum (matches
the Phase 1 DocumentType set — commercial_invoice, packing_list,
certificate_of_origin, bill_of_lading, air_waybill, export_declaration,
import_declaration, insurance_certificate, inspection_certificate,
fumigation_certificate, letter_of_credit, proforma_invoice), storage_path,
generated_by (user | doc_ai), signed_at nullable`), `uploaded_files` (looser
attachments — chat files, KYC submission scans).

## Row Level Security

Every tenant-scoped table has RLS enabled with, at minimum, a policy of the
shape:

```sql
create policy "org_members_can_select"
  on <table>
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where profile_id = auth.uid()
    )
  );
```

Write policies (`insert`/`update`/`delete`) additionally check the acting
member's role against the permission required for that mutation, via a
`has_permission(auth.uid(), organization_id, 'permission_key')` SQL function
shared across policies rather than duplicated per table.

Reference tables (`countries`, `hs_codes`, `tariffs`, etc.) are `select`-open
to any authenticated (or, for the Compliance Checker, `anon`) role, and
writable only by a `service_role`-scoped admin path — never by end users.

Public company-profile fields (name, verification badge, STS tier,
certifications) are exposed through a dedicated `public_organization_profiles`
view with narrowed columns, rather than relaxing RLS on `organizations`
itself — the base table never becomes readable to unauthenticated users.

## Migrations

- Drizzle schema is the source of truth; `drizzle-kit generate` produces SQL
  migrations checked into `supabase/migrations/`.
- CI applies pending migrations against a disposable Supabase branch/preview
  database and runs the full test suite before a migration is allowed to
  merge — a migration that breaks existing queries fails CI, not production.
- No destructive migration (`DROP COLUMN`, `DROP TABLE`, type-narrowing
  `ALTER COLUMN`) ships in the same deploy as the application code that stops
  using the old shape — always expand/contract across two deploys.
