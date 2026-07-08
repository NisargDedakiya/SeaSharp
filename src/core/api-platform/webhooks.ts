import "server-only";
import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { webhookEndpoints, webhookDeliveries } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { DomainEvent } from "@/core/events/types";

// Outbound webhook delivery — fired as an event-bus subscriber (registered
// in src/core/events/subscribers.ts), the same "one event, many
// subscribers" pattern the audit-log and notification subscribers use.
//
// Scope (documented, not accidental): single best-effort delivery attempt
// per event per endpoint. No retry queue/backoff — that needs durable job
// infra (e.g. a queue table + worker, or an external queue) which is out of
// scope for this MVP per the "no new infra" constraint. A failed delivery
// is logged and recorded in `webhook_deliveries` with its error; building
// at-least-once delivery with retries is called out in
// docs/06-api-integration-spec.md as a Phase 2 follow-up.

const SIGNATURE_HEADER = "X-SeaSharp-Signature";
const TIMESTAMP_HEADER = "X-SeaSharp-Timestamp";
const DELIVERY_TIMEOUT_MS = 5_000;

// Stripe-style signed payload: `t=<unix seconds>,v1=<hex hmac>` computed
// over `${timestamp}.${rawBody}` with the endpoint's per-endpoint secret.
// Verifying parties recompute the same HMAC after checking the timestamp is
// recent, which defeats naive replay of a captured payload.
export function signPayload(secret: string, timestamp: number, rawBody: string): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

async function deliverToEndpoint(
  endpoint: { id: string; url: string; secret: string; organizationId: string },
  event: DomainEvent
): Promise<void> {
  const body = JSON.stringify({ type: event.type, payload: event.payload, organizationId: event.organizationId });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(endpoint.secret, timestamp, body);

  let status: "SUCCESS" | "FAILED" = "FAILED";
  let responseStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SIGNATURE_HEADER]: signature,
          [TIMESTAMP_HEADER]: String(timestamp),
        },
        body,
        signal: controller.signal,
      });
      responseStatus = response.status;
      status = response.ok ? "SUCCESS" : "FAILED";
      if (!response.ok) errorMessage = `Endpoint responded with HTTP ${response.status}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown delivery error";
  }

  await serviceDb.insert(webhookDeliveries).values({
    webhookEndpointId: endpoint.id,
    organizationId: endpoint.organizationId,
    eventType: event.type,
    payload: event.payload,
    status,
    responseStatus,
    errorMessage,
  });

  if (status === "FAILED") {
    logger.warn({ endpointId: endpoint.id, eventType: event.type, errorMessage }, "webhook delivery failed");
  }
}

// Called by the subscriber registered in subscribers.ts. Looks up every
// active (non-revoked) endpoint for the event's organization that
// subscribed to this event type, and fires one delivery attempt each,
// concurrently. Events with no organizationId (none exist today, but the
// type allows it) simply have no endpoints to deliver to.
export async function deliverWebhooksForEvent(event: DomainEvent): Promise<void> {
  if (!event.organizationId) return;

  const endpoints = await serviceDb.query.webhookEndpoints.findMany({
    where: and(eq(webhookEndpoints.organizationId, event.organizationId), isNull(webhookEndpoints.revokedAt)),
  });

  const subscribed = endpoints.filter((endpoint) => {
    const types = (endpoint.eventTypes as string[]) ?? [];
    return types.includes(event.type);
  });

  await Promise.all(subscribed.map((endpoint) => deliverToEndpoint(endpoint, event)));
}
