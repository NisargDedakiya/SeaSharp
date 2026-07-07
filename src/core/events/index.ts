import "server-only";
// Side-effect import: registers the audit-log and notification subscribers.
// Any caller that imports emit()/subscribe() from "@/core/events" (rather
// than reaching into "./bus" directly) gets them wired automatically —
// there's no separate "init the event system" step to remember to call.
import "./subscribers";

export { emit, subscribe } from "./bus";
export { EVENT_TYPES, type EventType, type DomainEvent } from "./types";
