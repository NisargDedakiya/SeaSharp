import { pgTable, uuid, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { profiles, organizations } from "./identity";
import type { WidgetLayoutItem } from "@/components/dashboard/widgets/registry";

// Per-profile, per-organization dashboard widget layout — same shape as
// notification_preferences (src/db/schema/notifications.ts): a small,
// user-configurable preferences row keyed by profile (plus organization
// here, since a profile's dashboard differs by which org they're acting
// as). `widgets` stores the full ordered list so the client can show/hide
// and reorder without a schema change per widget type:
//   [{ id, type, visible, order }, ...]
// See src/components/dashboard/widgets/registry.ts for the WidgetType union
// and the default layout used when no row exists yet for a profile/org.
export const dashboardLayouts = pgTable(
  "dashboard_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    widgets: jsonb("widgets").$type<WidgetLayoutItem[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.profileId, table.organizationId)]
);
