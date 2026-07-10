import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { authUsers } from "@/db/schema";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api-handler";

// ---------------------------------------------------------------------------
// Identity adapter — plain Postgres, no Supabase.
//
// This project does not use Supabase (Auth, hosted Postgres, or otherwise):
// `DATABASE_URL`/`APP_DATABASE_URL` point at any self-hosted Postgres
// instance, and this module owns `auth.users` directly — bcrypt-hashed
// passwords, a signed JWT session cookie verified locally with no network
// call. See docs/README.md and docs/03-technical-architecture.md for the
// rationale.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "seasharp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const jwtSecret = new TextEncoder().encode(env.AUTH_JWT_SECRET);

export type SessionClaims = { sub: string; email: string };

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

export type AuthIdentity = { id: string; email: string };

// Creates the auth identity only (no `profiles` row) — used by
// register.ts's `registerUserAndOrganization`, which needs the identity
// before it can open its own profile+organization transaction.
export async function createAuthIdentity(params: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthIdentity> {
  const email = params.email.toLowerCase().trim();

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
// later step (e.g. profile/organization creation in register.ts) fails,
// this deletes it after the fact so a failed registration doesn't leave an
// orphaned auth user with no profile.
export async function deleteAuthIdentity(id: string): Promise<void> {
  try {
    await serviceDb.delete(authUsers).where(eq(authUsers.id, id));
  } catch {
    // Best-effort only — swallow so the original error from the failed step
    // is what surfaces to the caller.
  }
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string }> {
  const email = params.email.toLowerCase().trim();

  const user = await serviceDb.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (!user) throw new AppError(401, "Invalid email or password.");

  const valid = await bcrypt.compare(params.password, user.encryptedPassword);
  if (!valid) throw new AppError(401, "Invalid email or password.");

  return { id: user.id, email: user.email };
}
