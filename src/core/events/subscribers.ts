import "server-only";
import { serviceDb } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { notify } from "@/core/notifications/service";
import { deliverWebhooksForEvent } from "@/core/api-platform/webhooks";
import { subscribe } from "./bus";
import type { DomainEvent } from "./types";

// Every event becomes an audit log entry — this is the only writer of
// audit_logs in the codebase, so there's exactly one place that decides
// what "an auditable action" looks like.
subscribe(async (event) => {
  await serviceDb.insert(auditLogs).values({
    organizationId: event.organizationId ?? null,
    actorId: event.actorProfileId ?? null,
    action: event.type,
    metadata: event.payload,
  });
});

// Events whose payload names the profiles who should get an in-app
// notification (see the `recipientProfileIds` convention below) fan out to
// notify() — routes decide who cares about an event; this subscriber just
// delivers it.
subscribe(async (event: DomainEvent) => {
  const recipients = extractRecipients(event.payload);
  await Promise.all(
    recipients.map((profileId) => notify({ profileId, type: event.type, payload: event.payload }))
  );
});

// Task 6's Public API Platform: fires outbound webhooks for every event
// that has an organization, to every one of that org's active endpoints
// subscribed to the event's type — see src/core/api-platform/webhooks.ts
// for the single-best-effort-attempt delivery semantics and why there's no
// retry queue here. Same "every event becomes an X" shape as the audit-log
// and notification subscribers above.
subscribe(async (event: DomainEvent) => {
  await deliverWebhooksForEvent(event);
});

function extractRecipients(payload: Record<string, unknown>): string[] {
  const raw = payload.recipientProfileIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}
