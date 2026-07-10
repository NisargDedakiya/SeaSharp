import "server-only";
import { z } from "zod";

const envSchema = z.object({
  // Service-role connection (bypasses RLS) — migrations, seed, admin/background jobs.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // RLS-enforced `app_user` connection — every user-facing request. See src/db/client.ts.
  APP_DATABASE_URL: z.string().min(1, "APP_DATABASE_URL is required"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

// Fail fast on startup if required configuration is missing or malformed,
// rather than surfacing a confusing error deep inside a request handler.
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
