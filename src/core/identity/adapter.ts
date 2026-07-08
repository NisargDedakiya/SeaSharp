import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceDb } from "@/db/client";
import { authUsers, profiles } from "@/db/schema";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api-handler";

// ---------------------------------------------------------------------------
// Real Supabase Auth migration (Task 3)
//
// This module used to be a purely local stand-in for Supabase Auth (GoTrue):
// it wrote to `auth.users` in exactly the shape GoTrue would, specifically so
// swapping in real Supabase Auth later would be a matter of replacing this
// file's internals, not its callers. That swap is what this file now does —
// with one honest caveat: **this sandbox has no real Supabase project
// credentials and cannot reach a live GoTrue instance**, so the Supabase
// code path below is written to be mechanically correct but has only been
// verified by lint/tsc/tests, never against a real Supabase project. See
// docs/README.md's gap table and docs/03-technical-architecture.md.
//
// Two backends, selected automatically:
//   - Real Supabase Auth (`supabase-js`), used when SUPABASE_URL and
//     SUPABASE_SERVICE_ROLE_KEY are configured. `auth.users` is then owned
//     and populated by Supabase's GoTrue, not by this repo — see the
//     `profiles`/`auth.users` ownership note below.
//   - The original local bcrypt + `auth.users`-table stand-in, used when
//     Supabase isn't configured (this sandbox, and any local dev/CI run
//     without a Supabase project). Kept — not deleted — so the existing
//     test suite and local dev loop keep working without network access,
//     and so the local path can be cleanly removed later once every
//     environment has real Supabase credentials.
//
// Architectural decision — who owns `profiles.id` / `auth.users` now?
//   Once a real Supabase project is wired up, `DATABASE_URL` points directly
//   at *that project's* Postgres connection string (see README's "Why not
//   real Supabase here"), so the `auth.users` table this repo's Drizzle
//   schema describes (src/db/schema/identity.ts) is the *same physical
//   table* GoTrue owns — not a separate mirror. That means:
//     - This adapter (and register.ts) stop *writing* to `auth.users`
//       (`supabase.auth.signUp`/GoTrue does that now) but the FK from
//       `profiles.id -> auth.users.id` stays valid with zero schema change,
//       because it's still the same table underneath.
//     - `profiles` is keyed by the exact UUID Supabase Auth assigns
//       (`data.user.id` from `signUp`/`signInWithPassword`), preserving the
//       existing profiles/organization_members linkage untouched.
//     - In the *local fallback* backend (no live Supabase project), this
//       repo's own `auth.users` table is still written locally, since
//       there's no GoTrove to do it — this is the "local mirror" tradeoff:
//       correct and self-consistent for local dev/test, but not what
//       happens against a real Supabase project.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "seasharp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const jwtSecret = new TextEncoder().encode(env.AUTH_JWT_SECRET);

export type SessionClaims = { sub: string; email: string };

// Our own lightweight session cookie (signed JWT, verified locally with no
// network call) is kept as-is regardless of which auth backend is active.
// This is a deliberate choice, not an oversight: `signInWithPassword`/
// `signUp` only return `{ id, email }` (their existing, route-facing
// signature), so minting the app session token is decoupled from whichever
// backend authenticated the credentials. The alternative — storing
// Supabase's own access/refresh tokens in the cookie and verifying them via
// a Supabase call on every request — would require changing what the
// login/register routes store in the cookie, which the routes must not
// need to do (see src/app/api/auth/{login,logout,register}/route.ts).
export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export const supabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

// Service-role Supabase client — server-only (never sent to the client
// bundle, same convention as this file's `server-only` import), used for
// admin-level auth operations (signUp/signIn/signOut/verifyOtp/password
// reset). Lazily constructed so importing this module never throws when
// Supabase isn't configured (the local fallback is fully usable without it).
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new AppError(503, "Supabase Auth is not configured on this deployment.");
  }
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseAdmin;
}

export type AuthIdentity = { id: string; email: string };

// Creates the auth identity only (no `profiles` row) — shared by `signUp`
// below and by register.ts's `registerUserAndOrganization`, which needs the
// identity before it can open its own profile+organization transaction.
// Extracted here so both callers share one Supabase/local branch instead of
// duplicating it (the pre-migration code duplicated the bcrypt/`auth.users`
// logic between adapter.ts and register.ts).
export async function createAuthIdentity(params: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthIdentity> {
  const email = params.email.toLowerCase().trim();

  if (supabaseConfigured) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: params.fullName ? { data: { full_name: params.fullName } } : undefined,
    });
    if (error) {
      const alreadyExists = /already registered|already exists/i.test(error.message);
      throw new AppError(alreadyExists ? 409 : 400, alreadyExists ? "An account with that email already exists." : error.message);
    }
    if (!data.user) {
      throw new AppError(500, "Supabase Auth did not return a user.");
    }
    return { id: data.user.id, email: data.user.email ?? email };
  }

  // Local fallback (no live Supabase project) — same shape as before.
  const existing = await serviceDb.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (existing) {
    throw new AppError(409, "An account with that email already exists.");
  }

  const encryptedPassword = await bcrypt.hash(params.password, 10);

  try {
    const [user] = await serviceDb
      .insert(authUsers)
      .values({ email, encryptedPassword, emailConfirmedAt: new Date() })
      .returning({ id: authUsers.id, email: authUsers.email });
    return user;
  } catch (err) {
    // Race with the findFirst check above hitting the column's unique
    // constraint — surface it as the same friendly 409 rather than a raw
    // Postgres error.
    if (err instanceof Error && /unique/i.test(err.message)) {
      throw new AppError(409, "An account with that email already exists.");
    }
    throw err;
  }
}

// Best-effort compensating action: if the auth identity was created but a
// later step (e.g. profile/organization creation in register.ts) fails, we
// can't roll back the Supabase Auth signUp inside a Postgres transaction —
// it's a separate network call to a separate system. This deletes it after
// the fact so a failed registration doesn't leave an orphaned auth user
// with no profile. It's inherently not atomic with the DB transaction; a
// crash between the two leaves an orphaned Supabase Auth user, which is an
// acceptable, documented tradeoff versus blocking registration entirely on
// distributed-transaction machinery.
export async function deleteAuthIdentity(id: string): Promise<void> {
  try {
    if (supabaseConfigured) {
      await getSupabaseAdmin().auth.admin.deleteUser(id);
    } else {
      await serviceDb.delete(authUsers).where(eq(authUsers.id, id));
    }
  } catch {
    // Best-effort only — swallow so the original error from the failed step
    // is what surfaces to the caller.
  }
}

export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ id: string; email: string }> {
  const identity = await createAuthIdentity(params);
  try {
    await serviceDb.insert(profiles).values({ id: identity.id, fullName: params.fullName });
  } catch (err) {
    await deleteAuthIdentity(identity.id);
    throw err;
  }
  return identity;
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string }> {
  const email = params.email.toLowerCase().trim();

  if (supabaseConfigured) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: params.password });
    if (error || !data.user) {
      throw new AppError(401, "Invalid email or password.");
    }
    return { id: data.user.id, email: data.user.email ?? email };
  }

  const user = await serviceDb.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (!user) throw new AppError(401, "Invalid email or password.");

  const valid = await bcrypt.compare(params.password, user.encryptedPassword);
  if (!valid) throw new AppError(401, "Invalid email or password.");

  return { id: user.id, email: user.email };
}

// Used by the new logout/forgot-password/reset-password/verify-email
// routes. Not called by the pre-existing login/register routes, so it adds
// surface area without changing any existing signature.
export async function signOut(): Promise<void> {
  if (!supabaseConfigured) return; // local fallback has no server-side session to revoke
  await getSupabaseAdmin().auth.signOut();
}
