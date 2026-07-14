import { pgTable, pgEnum, uuid, text, timestamp, numeric, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { hsCodes, countries, products } from "./trade";
import { documents } from "./files";

export const rfqStatusEnum = pgEnum("rfq_status", ["OPEN", "AWARDED", "CANCELLED", "FULFILLED"]);
export const bidStatusEnum = pgEnum("bid_status", ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

export const rfqs = pgTable("rfqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id), // importer org
  product: text("product").notNull(),
  hsCode: text("hs_code")
    .notNull()
    .references(() => hsCodes.code),
  originCountry: text("origin_country")
    .notNull()
    .references(() => countries.code),
  destinationCountry: text("destination_country")
    .notNull()
    .references(() => countries.code),
  volume: numeric("volume", { precision: 14, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  targetPricePerUnit: numeric("target_price_per_unit", { precision: 14, scale: 4 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: rfqStatusEnum("status").default("OPEN").notNull(),
  awardedBidId: uuid("awarded_bid_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rfqItems = pgTable("rfq_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id")
    .notNull()
    .references(() => rfqs.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  volume: numeric("volume", { precision: 14, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  targetPricePerUnit: numeric("target_price_per_unit", { precision: 14, scale: 4 }).notNull(),
});

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id), // exporter org
    pricePerUnit: numeric("price_per_unit", { precision: 14, scale: 4 }).notNull(),
    message: text("message"),
    aiSuggestedPrice: numeric("ai_suggested_price", { precision: 14, scale: 4 }),
    status: bidStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.rfqId, table.organizationId)]
);

export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bids.id, { onDelete: "cascade" }),
  proposedByOrganizationId: uuid("proposed_by_organization_id")
    .notNull()
    .references(() => organizations.id),
  pricePerUnit: numeric("price_per_unit", { precision: 14, scale: 4 }).notNull(),
  message: text("message"),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A Deal is the importer's explicit confirmation of an awarded RFQ with the
// winning exporter — the commercial handshake layered on top of the award's
// escrow/shipment mechanics. Confirmed deals are what the exporter's
// dashboard lists and what funding_requests (src/db/schema/finance.ts) are
// raised against, so investors always finance a counterparty-confirmed
// trade, never a mere award.
export const dealStatusEnum = pgEnum("deal_status", ["CONFIRMED", "COMPLETED", "CANCELLED"]);

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id")
    .notNull()
    .unique() // one deal per RFQ — confirming twice is a conflict, not a second deal
    .references(() => rfqs.id),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bids.id),
  importerOrganizationId: uuid("importer_organization_id")
    .notNull()
    .references(() => organizations.id),
  exporterOrganizationId: uuid("exporter_organization_id")
    .notNull()
    .references(() => organizations.id),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  status: dealStatusEnum("status").default("CONFIRMED").notNull(),
  confirmedByProfileId: uuid("confirmed_by_profile_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id")
    .notNull()
    .references(() => rfqs.id),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bids.id),
  terms: jsonb("terms").notNull(),
  documentId: uuid("document_id").references(() => documents.id),
  importerSignedAt: timestamp("importer_signed_at", { withTimezone: true }),
  exporterSignedAt: timestamp("exporter_signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
