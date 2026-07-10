import {
  pgSchema,
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// Kept in a separate `auth` schema (rather than `public`) so identity data
// is namespaced apart from application tables, even though it's just plain
// Postgres underneath — see src/core/identity/adapter.ts, which owns this
// table directly (bcrypt-hashed passwords, no external auth provider).
const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  encryptedPassword: text("encrypted_password").notNull(),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationTypeEnum = pgEnum("organization_type", [
  "EXPORTER",
  "IMPORTER",
  "FREIGHT_FORWARDER",
  "CUSTOMS_BROKER",
  "WAREHOUSE_PROVIDER",
  "INSURANCE_PROVIDER",
  "FINANCE_PARTNER",
  "INVESTOR",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: organizationTypeEnum("type").notNull(),
  country: text("country"),
  kycStatus: kycStatusEnum("kyc_status").default("UNVERIFIED").notNull(),
  stsScore: integer("sts_score").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null organizationId = system default role (Owner/Admin/Member), shared across all orgs
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [unique().on(table.roleId, table.permissionId)]
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.organizationId, table.profileId)]
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => profiles.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Audit trail of STS recalculations (see src/lib/sts-server.ts) — distinct
// from audit_logs above, which covers general admin/security actions.
export const stsScoreLogs = pgTable("sts_score_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull(),
  kycPoints: integer("kyc_points").notNull(),
  onTimeDeliveryPoints: integer("on_time_delivery_points").notNull(),
  escrowSpeedPoints: integer("escrow_speed_points").notNull(),
  disputePoints: integer("dispute_points").notNull(),
  loanRepaymentPoints: integer("loan_repayment_points").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => profiles.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
