import "server-only";

// In-memory fixed-window rate limiter. Sufficient for a single-instance
// deployment; behind a load balancer with multiple app instances, swap the
// `hits` Map for a shared store (e.g. Redis via @upstash/ratelimit) so limits
// are enforced across instances instead of per-process.
type Bucket = { count: number; resetAt: number };

const hits = new Map<string, Bucket>();

// Periodically evict expired buckets so the map doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of Array.from(hits.entries())) {
    if (bucket.resetAt <= now) hits.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

/**
 * Fixed-window rate limit: allows `limit` requests per `windowMs` for a given key.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const existing = hits.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    hits.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, limit, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { success: true, limit, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function clientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Task 6's Public API Platform: a bearer API key gets its own rate-limit
// bucket keyed by the key's prefix (not the caller's IP), so a
// server-to-server integrator's limit follows their key across whatever
// egress IPs they call from, and so one API key's usage can't exhaust
// another key's (or an anonymous caller's) IP-keyed bucket. Only the
// prefix — never the secret — is used, and only a cheap string-prefix
// check, no DB/bcrypt lookup, so computing a rate-limit key never costs a
// database round trip. See src/core/api-platform/keys.ts#apiKeyPrefixFromAuthHeader.
export function rateLimitKeyFromRequest(request: Request): string {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.includes("sk_live_")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const dot = token.indexOf(".");
    const prefix = dot === -1 ? token : token.slice(0, dot);
    return `apikey:${prefix}`;
  }
  return `ip:${clientIpFromRequest(request)}`;
}
