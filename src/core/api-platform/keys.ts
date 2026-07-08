import "server-only";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { apiKeys } from "@/db/schema";
import { AppError } from "@/lib/api-handler";

// Live-environment prefix only for now (no sk_test_ split yet — see
// docs/06-api-integration-spec.md's "deferred" note). Kept as a named
// export so validation and issuance never hardcode the literal twice.
export const API_KEY_PREFIX = "sk_live_";

export type IssuedApiKey = { id: string; keyPrefix: string; plaintextKey: string };

// Issues a new key: `sk_live_<12 hex>.<secret>`. Only the hash of the part
// after the `.` is ever persisted — same bcrypt-hashing approach
// src/core/identity/adapter.ts uses for passwords. The full plaintext key
// is returned exactly once, at issuance; callers must show it to the user
// now because it cannot be recovered later.
export async function issueApiKey(params: {
  organizationId: string;
  createdByProfileId: string;
  name: string;
  scopes: string[];
}): Promise<IssuedApiKey> {
  const keyPrefix = `${API_KEY_PREFIX}${crypto.randomBytes(6).toString("hex")}`;
  const secret = crypto.randomBytes(24).toString("base64url");
  const plaintextKey = `${keyPrefix}.${secret}`;
  const hashedSecret = await bcrypt.hash(secret, 10);

  const [row] = await serviceDb
    .insert(apiKeys)
    .values({
      organizationId: params.organizationId,
      createdByProfileId: params.createdByProfileId,
      name: params.name,
      keyPrefix,
      hashedSecret,
      scopes: params.scopes,
    })
    .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix });

  return { id: row.id, keyPrefix: row.keyPrefix, plaintextKey };
}

export type ApiKeyContext = { organizationId: string; apiKeyId: string; scopes: string[] };

// Validates a bearer token presented as `Authorization: Bearer <token>`.
// Looks up by the unhashed, indexed `keyPrefix`, then bcrypt-compares the
// secret half against the stored hash — never a direct string/hash lookup
// on the full token. Returns null (never throws) on any failure so callers
// can fall back to session-cookie auth without special-casing errors.
export async function validateApiKey(token: string): Promise<ApiKeyContext | null> {
  if (!token.startsWith(API_KEY_PREFIX)) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const keyPrefix = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!secret) return null;

  const record = await serviceDb.query.apiKeys.findFirst({ where: eq(apiKeys.keyPrefix, keyPrefix) });
  if (!record || record.revokedAt) return null;

  const valid = await bcrypt.compare(secret, record.hashedSecret);
  if (!valid) return null;

  // Best-effort last-used bump — not awaited-critical-path, but kept simple
  // (single statement) rather than deferring it, since this is a low-volume
  // write compared to the request itself.
  await serviceDb.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, record.id));

  return { organizationId: record.organizationId, apiKeyId: record.id, scopes: (record.scopes as string[]) ?? [] };
}

export async function revokeApiKey(organizationId: string, id: string): Promise<void> {
  const [row] = await serviceDb
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  if (!row) throw new AppError(404, "API key not found.");
}

export async function listApiKeys(organizationId: string) {
  return serviceDb.query.apiKeys.findMany({
    where: eq(apiKeys.organizationId, organizationId),
    orderBy: (k, { desc }) => [desc(k.createdAt)],
  });
}

// Cheap, DB-free extraction of the key's prefix from an Authorization
// header — used by rate-limit.ts to key per-API-key limits without paying
// for a full bcrypt-verify on every request just to compute a rate-limit
// bucket key.
export function apiKeyPrefixFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token.startsWith(API_KEY_PREFIX)) return null;
  const dot = token.indexOf(".");
  return dot === -1 ? token : token.slice(0, dot);
}
