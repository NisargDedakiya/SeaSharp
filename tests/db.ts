import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";

// roles.organization_id is a (nullable) FK to organizations, so truncating
// organizations with CASCADE also wipes the global system roles
// (organization_id IS NULL) seeded once by global-setup — even though
// roles/permissions/role_permissions are never named directly in the
// truncate list below. Re-seed them after every truncate rather than
// fighting Postgres's cascade direction.
const SEED_SYSTEM_ROLES_SQL = readFileSync(
  join(__dirname, "..", "drizzle", "manual", "02_seed_system_roles.sql"),
  "utf8"
);

export async function clearTestDb() {
  const tables = await serviceDb.execute(
    sql`select tablename from pg_tables where schemaname = 'public'`
  );
  const names = (tables as unknown as Array<{ tablename: string }>).map((t) => `"${t.tablename}"`);
  if (names.length > 0) {
    await serviceDb.execute(sql.raw(`truncate table ${names.join(", ")} restart identity cascade`));
  }
  await serviceDb.execute(sql.raw(SEED_SYSTEM_ROLES_SQL));
}
