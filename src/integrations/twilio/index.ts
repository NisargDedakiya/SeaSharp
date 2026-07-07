import "server-only";
import { logger } from "@/lib/logger";

// Thin adapter over Twilio's SMS/WhatsApp API. Called by
// src/core/notifications/service.ts whenever a profile has the SMS or
// WHATSAPP channel enabled. Gated on TWILIO_ACCOUNT_SID — inert until
// configured, matching the resend adapter's pattern.
export type SendSmsParams = {
  to: string;
  body: string;
};

export async function sendSms(params: SendSmsParams): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.info({ to: params.to }, "twilio: no TWILIO_ACCOUNT_SID set, skipping send");
    return;
  }

  // Swap this block for the `twilio` SDK's messages.create(...) once that
  // package is added as a dependency.
  logger.info({ to: params.to }, "twilio: would send SMS");
}
