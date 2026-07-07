import "server-only";
import pino from "pino";

// pino-pretty's worker-thread transport doesn't reliably resolve under
// Next.js dev's webpack bundling (worker.js path resolution breaks after a
// `.next` cache clear/rebuild) — it's not worth the flakiness for console
// colorizing. Plain JSON lines everywhere, which is also what log
// aggregators (Datadog, CloudWatch, etc.) expect in production anyway.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});
