import { pgTable, pgEnum, uuid, text, timestamp, jsonb, boolean, unique } from "drizzle-orm/pg-core";
import { profiles } from "./identity";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "PUSH",
  "IN_APP",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    notificationType: text("notification_type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
  },
  (table) => [unique().on(table.profileId, table.channel, table.notificationType)]
);
