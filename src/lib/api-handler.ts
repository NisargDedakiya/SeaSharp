import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { clientIpFromRequest, rateLimit } from "@/lib/rate-limit";

// Expected, user-facing failures (not found, forbidden, conflict, etc.).
// Route handlers throw this instead of manually constructing a NextResponse,
// so every error path gets logged and shaped consistently.
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

type RouteContext<Params> = { params: Params };
type Handler<Params> = (request: Request, context: RouteContext<Params>) => Promise<Response>;

type ApiHandlerOptions = {
  /** Per-key request cap, keyed by client IP + route path. Omit for unlimited. */
  rateLimit?: { limit: number; windowMs: number };
};

// Wraps a Next.js route handler with: DB connection, structured request
// logging, centralized error mapping (Zod -> 400, AppError -> its status,
// anything else -> 500 with details hidden in production), and optional
// per-route rate limiting.
export function withApiHandler<Params = Record<string, string>>(
  handler: Handler<Params>,
  options?: ApiHandlerOptions
): Handler<Params> {
  return async (request, context) => {
    const start = Date.now();
    const requestId = randomUUID();
    const { method } = request;
    const path = new URL(request.url).pathname;
    const log = logger.child({ requestId, method, path });

    try {
      if (options?.rateLimit) {
        const ip = clientIpFromRequest(request);
        const result = rateLimit(`${path}:${ip}`, options.rateLimit.limit, options.rateLimit.windowMs);
        if (!result.success) {
          log.warn({ ip }, "rate limit exceeded");
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
              status: 429,
              headers: { "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString() },
            }
          );
        }
      }

      const response = await handler(request, context);
      log.info({ status: response.status, durationMs: Date.now() - start }, "request completed");
      return response;
    } catch (err) {
      if (err instanceof ZodError) {
        log.warn({ issues: err.issues }, "validation error");
        return NextResponse.json({ error: err.flatten() }, { status: 400 });
      }
      if (err instanceof AppError) {
        log.warn({ status: err.status, message: err.message }, "handled error");
        return NextResponse.json({ error: err.message }, { status: err.status });
      }

      log.error({ err }, "unhandled error");
      // No-ops when SENTRY_DSN isn't configured (see sentry.server.config.ts).
      Sentry.captureException(err, { extra: { requestId, method, path } });
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "production"
              ? "Internal server error."
              : (err as Error).message,
        },
        { status: 500 }
      );
    }
  };
}
