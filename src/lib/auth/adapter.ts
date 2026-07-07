import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { authUsers, profiles } from "@/db/schema";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api-handler";

// A local stand-in for Supabase Auth (GoTrue) — this sandbox cannot run the
// real Supabase stack (see docs/README.md's current-state table). This
// module exposes the same essential surface a Supabase Auth client would
// (sign up, sign in, verify session) and writes to `auth.users` in exactly
// the shape GoTrue would, so swapping in real Supabase Auth later is a
// matter of replacing this file's internals, not the callers.

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

export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ id: string; email: string }> {
  const email = params.email.toLowerCase().trim();

  const existing = await serviceDb.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (existing) {
    throw new AppError(409, "An account with that email already exists.");
  }

  const encryptedPassword = await bcrypt.hash(params.password, 10);

  const [user] = await serviceDb
    .insert(authUsers)
    .values({ email, encryptedPassword, emailConfirmedAt: new Date() })
    .returning({ id: authUsers.id, email: authUsers.email });

  await serviceDb.insert(profiles).values({ id: user.id, fullName: params.fullName });

  return user;
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
