import { pgTable, pgEnum, uuid, text, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { rfqs } from "./marketplace";
import { ports } from "./trade";

export const freightModeEnum = pgEnum("freight_mode", ["SEA", "AIR", "ROAD"]);

// Fixed forward-only sequence used by the award/escrow-release flow (see
// docs/04-database-design.md#logistics-domain). Mirrors Phase 1's
// TRANSPORT_STAGES exactly for feature parity.
export const transportStageEnum = pgEnum("transport_stage", [
  "PICKUP",
  "PORT_TRANSIT",
  "INTERNATIONAL_FREIGHT",
  "CUSTOMS_CLEARANCE",
  "DELIVERY",
  "COMPLETE",
]);

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id")
    .notNull()
    .unique()
    .references(() => rfqs.id),
  exporterOrganizationId: uuid("exporter_organization_id")
    .notNull()
    .references(() => organizations.id),
  importerOrganizationId: uuid("importer_organization_id")
    .notNull()
    .references(() => organizations.id),
  mode: freightModeEnum("mode").notNull(),
  transportStage: transportStageEnum("transport_stage").default("PICKUP").notNull(),
  status: text("status").default("IN_PROGRESS").notNull(), // IN_PROGRESS | COMPLETE | DISPUTED
  trackingNumber: text("tracking_number"),
  originLocation: text("origin_location").notNull(),
  destinationLocation: text("destination_location").notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 14, scale: 2 }),
  customsClearedAt: timestamp("customs_cleared_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  // Snapshots the exporter's STS at deal time — the score itself keeps
  // moving, but what mattered for this specific award is preserved.
  stsScoreAtTimeOfDeal: numeric("sts_score_at_time_of_deal", { precision: 6, scale: 0 }).notNull(),
  aiRouteRecommendation: text("ai_route_recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Append-only event log — a v2.0 addition beyond Phase 1's single
// transportStage pointer; not yet wired into any route.
export const shipmentTracking = pgTable("shipment_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  stage: transportStageEnum("stage").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  source: text("source").notNull(), // carrier_api | manual | customs_feed
  metadata: jsonb("metadata"),
});

export const carriers = pgTable("carriers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  scacCode: text("scac_code"),
});

export const logisticsRoutes = pgTable("logistics_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  originPortId: uuid("origin_port_id").references(() => ports.id),
  destinationPortId: uuid("destination_port_id").references(() => ports.id),
  mode: text("mode").notNull(),
  estimatedDays: numeric("estimated_days", { precision: 6, scale: 1 }),
  estimatedCostPerUnit: numeric("estimated_cost_per_unit", { precision: 14, scale: 4 }),
});

export const freightQuotes = pgTable("freight_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  carrierId: uuid("carrier_id").references(() => carriers.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  bookedAt: timestamp("booked_at", { withTimezone: true }),
});

export const containers = pgTable("containers", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  containerNumber: text("container_number").notNull(),
  sealNumber: text("seal_number"),
});
