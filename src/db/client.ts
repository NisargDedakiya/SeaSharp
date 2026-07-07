import "server-only";
import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "@/lib/env";

// Two connections, mirroring how a real Supabase deployment separates the
// service-role key (bypasses RLS, used for migrations/seed/admin/background
// jobs) from PostgREST's `authenticated` role (RLS-enforced, used for every
// user-facing request). See docs/04-database-design.md#row-level-security
// and drizzle/0001_rls_and_roles.sql for how these roles are provisioned.

const serviceConnection = postgres(env.DATABASE_URL, { max: 5 });
// Service-role connection: bypasses RLS entirely. Only use this for
// migrations, the seed script, and genuinely trusted admin/background code
// — never for a request scoped to a specific user.
export const serviceDb = drizzle(serviceConnection, { schema });

const appConnection = postgres(env.APP_DATABASE_URL, { max: 10 });
const appDb = drizzle(appConnection, { schema });

/**
 * Runs `fn` against the RLS-enforced `app_user` connection, with
 * `request.jwt.claims` set to `{ "sub": profileId }` for the duration of one
 * transaction — this is what makes `auth.uid()` resolve inside RLS policies.
 * Pass `profileId: null` for an anonymous/public request (e.g. the
 * Compliance Checker): `auth.uid()` then returns null and only policies that
 * explicitly allow anonymous access (there are none by default) let rows
 * through.
 */
export async function withRlsContext<T>(
  profileId: string | null,
  fn: (tx: typeof appDb) => Promise<T>
): Promise<T> {
  return appConnection.begin(async (sql) => {
    const claims = JSON.stringify({ sub: profileId ?? "" });
    await sql`select set_config('request.jwt.claims', ${claims}, true)`;
    // postgres.js's TransactionSql is structurally a Sql at runtime; the
    // type-only mismatch is between its generic params and Sql<{}>.
    const tx = drizzle(sql as unknown as Sql, { schema });
    return fn(tx);
  }) as Promise<T>;
}
