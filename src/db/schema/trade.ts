import { pgTable, uuid, text, timestamp, numeric, jsonb, boolean, unique } from "drizzle-orm/pg-core";
import { organizations } from "./identity";

// Reference data — globally shared, admin-managed, no organizationId.
export const countries = pgTable("countries", {
  code: text("code").primaryKey(), // ISO 3166-1 alpha-2
  name: text("name").notNull(),
  region: text("region"),
});

export const ports = pgTable("ports", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  countryCode: text("country_code")
    .notNull()
    .references(() => countries.code),
  unlocode: text("unlocode").unique(),
});

export const hsCodes = pgTable("hs_codes", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  category: text("category").notNull(),
});

export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hsCode: text("hs_code")
      .notNull()
      .references(() => hsCodes.code),
    originCountry: text("origin_country")
      .notNull()
      .references(() => countries.code),
    destinationCountry: text("destination_country")
      .notNull()
      .references(() => countries.code),
    dutyRatePercent: numeric("duty_rate_percent", { precision: 6, scale: 3 }).notNull(),
    additionalFeePercent: numeric("additional_fee_percent", { precision: 6, scale: 3 }).default("0").notNull(),
    notes: text("notes"),
  },
  (table) => [
    unique().on(table.hsCode, table.originCountry, table.destinationCountry),
  ]
);

export const tradeRules = pgTable("trade_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryCode: text("country_code")
    .notNull()
    .references(() => countries.code),
  hsCode: text("hs_code").references(() => hsCodes.code),
  requiredDocuments: jsonb("required_documents").notNull(), // string[]
  requiredCertificates: jsonb("required_certificates"), // string[]
  notes: text("notes"),
});

// The concrete, per-document Compliance Checker checklist — distinct from
// trade_rules above (which is a coarser future FTA/rules construct). Mirrors
// the Phase 1 Mongoose `ComplianceDocument` shape exactly for feature parity.
export const complianceDocuments = pgTable("compliance_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  destinationCountry: text("destination_country").notNull(), // "*" means all destinations
  hsCode: text("hs_code"), // null = applies regardless of HS code
  name: text("name").notNull(),
  description: text("description").notNull(),
  required: boolean("required").default(true).notNull(),
});

export const restrictedProducts = pgTable("restricted_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  hsCode: text("hs_code")
    .notNull()
    .references(() => hsCodes.code),
  countryCode: text("country_code").references(() => countries.code), // null = globally restricted
  reason: text("reason").notNull(),
});

// Org-owned, not reference data.
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  countryCode: text("country_code")
    .notNull()
    .references(() => countries.code),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hsCode: text("hs_code").references(() => hsCodes.code),
  defaultUnit: text("default_unit"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
