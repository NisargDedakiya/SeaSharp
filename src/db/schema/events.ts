import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations, profiles } from "./identity";

// Every domain action (RFQ_CREATED, BID_SUBMITTED, RFQ_AWARDED,
// ESCROW_MILESTONE_RELEASED, KYC_VERIFIED, LOAN_DECIDED, ...) is persisted
// here by src/core/events/bus.ts, independent of who ends up subscribing to
// it. Notifications, audit logging, and future analytics/AI training data
// all read from this one table instead of each route hand-rolling its own
// side effects. See docs/01-product-vision.md and
// src/core/events/types.ts for the full event catalog.
export const domainEvents = pgTable("domain_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  actorProfileId: uuid("actor_profile_id").references(() => profiles.id),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
