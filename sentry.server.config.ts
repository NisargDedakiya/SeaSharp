import * as Sentry from "@sentry/nextjs";

// Only activate when a DSN is actually configured — keeps local dev and any
// deployment without Sentry credentials completely silent (no network
// calls, no console noise), while production with SENTRY_DSN set gets full
// error tracking with no code changes.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
