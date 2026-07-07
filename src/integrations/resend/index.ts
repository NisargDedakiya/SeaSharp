import "server-only";
import { logger } from "@/lib/logger";

// Thin adapter over Resend's email API. Called by
// src/core/notifications/service.ts whenever a profile has the EMAIL
// channel enabled for a notification type. Gated on RESEND_API_KEY exactly
// like @sentry/nextjs is gated on SENTRY_DSN elsewhere in this codebase —
// inert (logs instead of sending) until a real key is configured, so local
// dev and CI never make a live network call.
export type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.info({ to: params.to, subject: params.subject }, "resend: no RESEND_API_KEY set, skipping send");
    return;
  }

  // Swap this block for `new Resend(process.env.RESEND_API_KEY).emails.send(...)`
  // once the `resend` package is added as a dependency.
  logger.info({ to: params.to, subject: params.subject }, "resend: would send email");
}
