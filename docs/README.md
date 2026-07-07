# SeaSharp Documentation — The v2.0 Constitution Set

This directory is the single source of truth for where SeaSharp is *going*.
Every future feature, migration, and code change should trace back to one of
these six documents. When a document and the running code disagree, that's a
signal to update one of them deliberately — not to let them silently drift.

| # | Document | Answers |
|---|----------|---------|
| 1 | [Product Vision](./01-product-vision.md) | Why does SeaSharp exist, and where is it headed? |
| 2 | [Product Requirements (PRD)](./02-product-requirements.md) | What exactly does each feature do, and when is it "done"? |
| 3 | [Technical Architecture](./03-technical-architecture.md) | How is the system built, structured, and deployed? |
| 4 | [Database Design](./04-database-design.md) | What's the schema, and how is data protected? |
| 5 | [UI/UX Design System](./05-ui-ux-design-system.md) | What does SeaSharp look and feel like? |
| 6 | [API & Integration Spec](./06-api-integration-spec.md) | How do clients and partners talk to SeaSharp? |

## Current state vs. v2.0 target — read this first

**These documents describe the v2.0 target architecture.** The database,
ORM, auth, and identity model columns below are now live — not a future
target — following the stack migration. What's still target-only is the
newer platform surface (Notifications, Admin Console, Wallet/Ledger, real
Supabase Auth/Storage/Realtime, Next.js 15). Concretely:

| | Today (shipped) | v2.0 target (this doc set) |
|---|---|---|
| Database | **Postgres via Drizzle ORM, real transactions + Row Level Security** ✅ | Supabase PostgreSQL via Drizzle ORM, Row Level Security |
| Auth | Local Supabase-Auth-compatible adapter (`src/core/identity/adapter.ts`) — same `auth.users` shape, JWT session cookies | Real Supabase Auth (GoTrue) — see [top-level README § Why not real Supabase here](../README.md#why-not-real-supabase-here) |
| Framework | Next.js 14 (App Router) | Next.js 15 (App Router) |
| Identity model | **Organizations, RBAC (roles/permissions), organization_members** ✅ | Same, plus teams/departments and invitation acceptance flow |
| Code structure | **Core Engine (`src/core/<engine>/`) + AI Platform (`src/core/ai/`) + Event Bus (`src/core/events/`) + Workflow Engine (`src/core/workflow/`) + Integrations (`src/integrations/`)** ✅ | Same — see [Technical Architecture § Folder structure](./03-technical-architecture.md#folder-structure) |
| Domains live | Identity/Orgs, Trade Intelligence, RFQ Marketplace, Logistics (stub), Trade Finance (stub), STS, KYC (stub), event log + in-app notifications | All of the above, plus Activity Center UI, Company Profiles, Admin Console, Wallet/Ledger, full AI service layer, email/SMS delivery |
| Storage | None (no file uploads yet) | Supabase Storage buckets for documents/contracts/certificates/avatars |
| Realtime | Polling (`CountdownTimer`) | Supabase Realtime channels |

The top-level [`README.md`](../README.md) describes what's actually running.
This directory describes what we're building toward. The identity/database
foundation and the Trade Intelligence + Marketplace domains have been
migrated onto that foundation; the newer v2.0-only platform surface
(Notifications, Admin Console, real Supabase Auth, etc.) has not been built
yet — see [Product Vision § Roadmap](./01-product-vision.md#roadmap) for the
phased plan that gap follows.

## How to use these documents

- **Adding a feature?** Find its layer in the [Technical Architecture](./03-technical-architecture.md),
  check its acceptance criteria in the [PRD](./02-product-requirements.md),
  and confirm the schema in [Database Design](./04-database-design.md)
  before writing code.
- **Changing the schema?** Update [Database Design](./04-database-design.md)
  in the same PR as the migration.
- **Adding an endpoint or webhook?** Follow the conventions in the
  [API & Integration Spec](./06-api-integration-spec.md) rather than
  inventing a new pattern.
- **Building a screen?** Reuse the tokens and components in the
  [UI/UX Design System](./05-ui-ux-design-system.md) instead of one-off styling.
- **Unsure if something is in scope?** Check the [Product Vision](./01-product-vision.md)'s
  phase roadmap — if it's not in the current phase, it's a fast-follow, not a
  blocker.
