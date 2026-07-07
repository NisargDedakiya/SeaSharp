import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations, profiles } from "./identity";

// Mirrors the Phase 1 Mongoose `DocumentType` set — see
// docs/04-database-design.md#files-domain.
export const documentTypeEnum = pgEnum("document_type", [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "EXPORT_DECLARATION",
  "IMPORT_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "INSPECTION_CERTIFICATE",
  "FUMIGATION_CERTIFICATE",
  "LETTER_OF_CREDIT",
  "PROFORMA_INVOICE",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  storagePath: text("storage_path").notNull(),
  generatedBy: text("generated_by").default("USER").notNull(), // USER | DOC_AI
  signedAt: timestamp("signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => profiles.id),
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
