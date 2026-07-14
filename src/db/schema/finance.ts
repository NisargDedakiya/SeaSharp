import { pgTable, pgEnum, uuid, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { rfqs, deals } from "./marketplace";

// Mirrors Phase 1's ESCROW_STATUSES exactly for feature parity — see
// src/app/api/rfqs/[id]/award/route.ts and .../escrow/[id]/release/route.ts.
export const escrowStatusEnum = pgEnum("escrow_status", [
  "PENDING",
  "FUNDED",
  "PARTIALLY_RELEASED",
  "RELEASED",
  "DISPUTED",
  "REFUNDED",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", ["PENDING", "COMPLETE"]);

export const escrowAccounts = pgTable("escrow_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id")
    .notNull()
    .unique()
    .references(() => rfqs.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  status: escrowStatusEnum("status").default("PENDING").notNull(),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Always read/written together with their escrow (whole-amount release at
// the final milestone, not per-milestone amounts) — see award/route.ts.
export const escrowMilestones = pgTable("escrow_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  escrowAccountId: uuid("escrow_account_id")
    .notNull()
    .references(() => escrowAccounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  status: milestoneStatusEnum("status").default("PENDING").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id").references(() => rfqs.id),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  status: text("status").default("DRAFT").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  escrowAccountId: uuid("escrow_account_id").references(() => escrowAccounts.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  stripeEventId: text("stripe_event_id").unique(), // idempotency guard against duplicate webhooks
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  currency: text("currency").default("USD").notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).default("0").notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // signed: +credit / -debit
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Mirrors Phase 1's LOAN_STATUSES exactly — see src/app/api/loans/route.ts.
export const tradeLoanStatusEnum = pgEnum("trade_loan_status", [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "FUNDED",
  "REPAID",
  "DEFAULTED",
  "REJECTED",
]);

// Investor-directed financing raised against a confirmed Deal
// (src/db/schema/marketplace.ts). Distinct from trade_loans below, which is
// the platform's own AI-scored (CreditLayer) PO-financing decision: a
// funding_request is an OPEN ask that sits in front of INVESTOR /
// FINANCE_PARTNER organizations (the dashboard's Funding Opportunities
// widget) until one of them funds it.
export const fundingRequestKindEnum = pgEnum("funding_request_kind", ["LOAN", "ADVANCE"]);
export const fundingRequestStatusEnum = pgEnum("funding_request_status", [
  "OPEN",
  "FUNDED",
  "WITHDRAWN",
]);

export const fundingRequests = pgTable("funding_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  exporterOrganizationId: uuid("exporter_organization_id")
    .notNull()
    .references(() => organizations.id),
  kind: fundingRequestKindEnum("kind").default("LOAN").notNull(),
  requestedAmount: numeric("requested_amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  note: text("note"),
  status: fundingRequestStatusEnum("status").default("OPEN").notNull(),
  // The INVESTOR / FINANCE_PARTNER org that funded it; null while OPEN.
  funderOrganizationId: uuid("funder_organization_id").references(() => organizations.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
});

export const tradeLoans = pgTable("trade_loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id").references(() => rfqs.id),
  exporterOrganizationId: uuid("exporter_organization_id")
    .notNull()
    .references(() => organizations.id),
  requestedAmount: numeric("requested_amount", { precision: 14, scale: 2 }).notNull(),
  approvedAmount: numeric("approved_amount", { precision: 14, scale: 2 }),
  interestRatePercent: numeric("interest_rate_percent", { precision: 6, scale: 3 }),
  riskBand: text("risk_band"),
  status: tradeLoanStatusEnum("status").default("REQUESTED").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  repaidAt: timestamp("repaid_at", { withTimezone: true }),
});
