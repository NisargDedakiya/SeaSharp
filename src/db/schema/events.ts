import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations, profiles } from "./identity";

// Every domain action (RFQ_CREATED, BID_SUBMITTED, RFQ_AWARDED,
// ESCROW_MILESTONE_RELEASED, KYC_VERIFIED, LOAN_DECIDED, ...) is persisted
// here by src/core/events/bus.ts, independent of who ends up subscribing to
// it. Notifications, audit logging, and future analytics/AI training data
// all read from this one table instead of each route hand-rolling its own
// side effects. See docs/01-product-vision.md and
// src/core/events/types.ts for the full event catalog.
export const domainEvents = pgTable(
  "domain_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // src/core/audit/timeline.ts (Task 2's audit trail) looks up every
  // domain_events row for an RFQ via payload->>'rfqId' — index that
  // expression rather than let the audit timeline query scan the whole
  // table as events accumulate.
  (table) => [index("domain_events_payload_rfq_id_idx").on(sql`(${table.payload}->>'rfqId')`)]
);
