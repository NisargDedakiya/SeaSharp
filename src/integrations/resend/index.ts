import "server-only";
import { Resend } from "resend";
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

const EMAIL_FROM = process.env.EMAIL_FROM || "SeaSharp <onboarding@resend.dev>";

let _resend: Resend | null = null;
function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.info({ to: params.to, subject: params.subject }, "resend: no RESEND_API_KEY set, skipping send");
    return;
  }

  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  if (error) {
    // Mirrors validateApiKey/deleteAuthIdentity's "never throw into the
    // caller's request lifecycle for a best-effort side channel" convention
    // — a failed notification email shouldn't fail the action that
    // triggered it (e.g. an RFQ award), just get logged.
    logger.error({ to: params.to, subject: params.subject, err: error }, "resend: send failed");
    return;
  }

  logger.info({ to: params.to, subject: params.subject }, "resend: sent email");
}
