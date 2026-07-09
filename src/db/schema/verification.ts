import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations, profiles, kycStatusEnum } from "./identity";
import { uploadedFiles } from "./files";

// KYC/KYB submission records — docs/02-product-requirements.md §1.4. An
// organization submits registration documents, tax ID, and
// beneficial-ownership info; runSupplierCheck() (src/core/ai/compliance-ai.ts)
// flags anomalies against those fields; the resulting status feeds
// organizations.kycStatus (which remains the single source of truth for
// gating/STS — see src/core/finance/sts-server.ts) while this table keeps
// the full submission history. Automated approve/reject only — a
// human/admin review queue is deferred to the Phase 5 Admin Console, which
// doesn't exist yet in this codebase (no platform-admin role).
export const kycSubmissions = pgTable(
  "kyc_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submittedByProfileId: uuid("submitted_by_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    legalCompanyName: text("legal_company_name").notNull(),
    registrationNumber: text("registration_number").notNull(),
    taxId: text("tax_id").notNull(),
    country: text("country").notNull(),
    // [{ name: string, ownershipPercent: number }, ...]
    beneficialOwners: jsonb("beneficial_owners")
      .$type<{ name: string; ownershipPercent: number | null }[]>()
      .notNull()
      .default([]),
    registrationDocumentFileId: uuid("registration_document_file_id").references(
      () => uploadedFiles.id,
      { onDelete: "set null" }
    ),
    taxDocumentFileId: uuid("tax_document_file_id").references(() => uploadedFiles.id, {
      onDelete: "set null",
    }),
    status: kycStatusEnum("status").notNull().default("PENDING"),
    flags: jsonb("flags").$type<string[]>().notNull().default([]),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("kyc_submissions_org_idx").on(table.organizationId)]
);
