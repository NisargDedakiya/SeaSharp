import postgres from "postgres";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// Redirects DATABASE_URL/APP_DATABASE_URL to a dedicated `_test` database on
// the same Postgres server (created fresh each run), then applies the
// Drizzle table migrations and the hand-written RLS/roles bootstrap — the
// same two steps `npm run db:migrate && npm run db:bootstrap` do for local
// dev, just against a disposable database so the suite's aggressive
// truncation (see tests/db.ts) never touches real data. CI provides
// DATABASE_URL/APP_DATABASE_URL pointing at its Postgres service container;
// local runs pick up .env if present.
export async function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env file — fine, CI sets these env vars directly
  }

  // Force local identity fallback during Vitest integration tests to avoid
  // rate limits, network fragility, and pollution of the real Supabase project.
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_ANON_KEY = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";

  // Force local PostgreSQL server for fast, low-latency test execution.
  process.env.DATABASE_URL = "postgres://postgres@localhost:5432/seasharp";
  process.env.APP_DATABASE_URL = "postgres://app_user:app_user_dev_password@localhost:5432/seasharp";

  const baseUrl = new URL(process.env.DATABASE_URL!);
  const testDbName = `${baseUrl.pathname.slice(1)}_test`;

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.unsafe(`CREATE DATABASE "${testDbName}"`);
  await admin.end();

  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${testDbName}`;
  process.env.DATABASE_URL = testUrl.toString();

  const appBaseUrl = new URL(process.env.APP_DATABASE_URL!);
  const appTestUrl = new URL(appBaseUrl);
  appTestUrl.pathname = `/${testDbName}`;
  process.env.APP_DATABASE_URL = appTestUrl.toString();

  const migrationsDir = join(__dirname, "..", "drizzle");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const sql = postgres(testUrl.toString(), { max: 1 });
  try {
    for (const file of migrationFiles) {
      await sql.unsafe(readFileSync(join(migrationsDir, file), "utf8"));
    }

    const manualDir = join(migrationsDir, "manual");
    const manualFiles = readdirSync(manualDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of manualFiles) {
      await sql.unsafe(readFileSync(join(manualDir, file), "utf8"));
    }
  } finally {
    await sql.end();
  }
}

export async function teardown() {
  // The test database is dropped at the start of the next run, not here —
  // leaving it around after a failure makes it easier to inspect.
}
