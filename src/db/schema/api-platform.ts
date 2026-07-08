import { pgTable, uuid, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { organizations, profiles } from "./identity";

// Task 6's Public API Platform: org-scoped API keys for server-to-server
// access (an alternative to the session cookie, see src/lib/api-handler.ts)
// and outbound webhook subscriptions delivered as an event-bus subscriber
// (src/core/events/subscribers.ts), the same "one event, many subscribers"
// pattern the audit-log and notification subscribers already use.

// Key format: `sk_live_<12 hex chars>.<32 base64url chars>` — the part
// before the `.` (`keyPrefix`) is stored in the clear so a presented key can
// be looked up by an indexed equality match; the part after the `.` is the
// actual secret and is bcrypt-hashed exactly like passwords in
// src/core/identity/adapter.ts, never stored or logged in plaintext. Only
// `keyPrefix` is shown again after creation (e.g. in a "keys" management
// list) — the full key is shown once, at issuance.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByProfileId: uuid("created_by_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull().unique(),
    hashedSecret: text("hashed_secret").notNull(),
    // e.g. ["search:read", "audit:read"] — see docs/06-api-integration-spec.md
    // for the scope catalog. Not yet enforced per-route beyond org
    // resolution; routes that should check a scope do so explicitly.
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("api_keys_org_idx").on(table.organizationId)]
);

// A partner's registered HTTP endpoint + the event types it wants delivered.
// `secret` is the HMAC signing key for the `X-SeaSharp-Signature` header
// (see src/core/api-platform/webhooks.ts) — unlike apiKeys.hashedSecret this
// is a symmetric key we must read back to sign every delivery, so (like a
// third party's Stripe webhook secret) it is stored as-issued, not hashed;
// it is never echoed back to the caller after creation.
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventTypes: jsonb("event_types").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("webhook_endpoints_org_idx").on(table.organizationId)]
);

// One row per delivery attempt — a best-effort log, not a retry queue (see
// docs/06-api-integration-spec.md's Phase 2 stub note: at-least-once
// delivery with backoff retry is a documented future enhancement, not built
// here — this MVP does a single attempt and records the outcome).
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookEndpointId: uuid("webhook_endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    // Denormalized from webhookEndpoints for simple org-scoped RLS (same
    // convention as domain_events/audit_logs carrying organization_id
    // directly rather than requiring a join for row-level security).
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(), // 'SUCCESS' | 'FAILED'
    responseStatus: integer("response_status"),
    errorMessage: text("error_message"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("webhook_deliveries_org_idx").on(table.organizationId)]
);
