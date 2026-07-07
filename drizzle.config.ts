import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations are generated/applied with the service-role connection
// (DATABASE_URL) — the same superuser-equivalent connection used by
// scripts/seed.ts and admin/background jobs. The running app uses a
// separate, non-superuser APP_DATABASE_URL connection so Row Level
// Security actually applies to it — see src/db/client.ts and
// docs/04-database-design.md#row-level-security.
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public", "auth"],
});
