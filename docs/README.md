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

**These documents describe the v2.0 target architecture, not what's running
today.** Don't let that ambiguity cause a wrong deploy or a confused
onboarding. Concretely:

| | Today (Phase 1, shipped) | v2.0 target (this doc set) |
|---|---|---|
| Database | MongoDB via Mongoose, multi-doc transactions on a replica set | Supabase PostgreSQL via Drizzle ORM, Row Level Security |
| Auth | NextAuth (Credentials provider) | Supabase Auth |
| Framework | Next.js 14 (App Router) | Next.js 15 (App Router) |
| Identity model | Flat `User` with a `role` enum | Organizations, teams, members, RBAC, invitations |
| Domains live | Trade Intelligence, RFQ Marketplace, Logistics (stub), Trade Finance (stub), STS, KYC (stub) | All of the above, plus Notifications, Activity Center, Company Profiles, Admin Console, Wallet/Ledger, full AI service layer |
| Storage | None (no file uploads yet) | Supabase Storage buckets for documents/contracts/certificates/avatars |
| Realtime | Polling (`CountdownTimer`) | Supabase Realtime channels |

The top-level [`README.md`](../README.md) describes what's actually running.
This directory describes what we're building toward. Phase 1 was deliberately
scoped tight (see [Product Vision § Roadmap](./01-product-vision.md#roadmap))
— the gap between the two tables above is not drift, it's the plan.

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
