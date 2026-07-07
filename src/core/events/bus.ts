import "server-only";
import { serviceDb } from "@/db/client";
import { domainEvents } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { DomainEvent } from "./types";

type Subscriber = (event: DomainEvent) => Promise<void> | void;

const subscribers: Subscriber[] = [];

// Registers a handler that runs on every emitted event. Called once at
// module load by src/core/events/subscribers.ts — see index.ts for why
// importing from "@/core/events" is enough to wire this up automatically.
export function subscribe(fn: Subscriber) {
  subscribers.push(fn);
}

// Persists the event, then runs every subscriber in order. A subscriber
// failure is logged and never rethrown — one broken subscriber (e.g. a
// notification write) must not roll back the business transaction that
// already committed before emit() was called.
export async function emit(event: DomainEvent): Promise<void> {
  await serviceDb.insert(domainEvents).values({
    type: event.type,
    organizationId: event.organizationId ?? null,
    actorProfileId: event.actorProfileId ?? null,
    payload: event.payload,
  });

  for (const subscriber of subscribers) {
    try {
      await subscriber(event);
    } catch (err) {
      logger.error({ err, eventType: event.type }, "event subscriber failed");
    }
  }
}
