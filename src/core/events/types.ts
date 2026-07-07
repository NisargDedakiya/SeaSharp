// The event catalog. Every entry here is something a subscriber (audit log,
// notifications, future analytics/AI training pipelines) might care about —
// see docs/01-product-vision.md for how these compound across the platform.
export const EVENT_TYPES = [
  "RFQ_CREATED",
  "BID_SUBMITTED",
  "RFQ_AWARDED",
  "ESCROW_MILESTONE_RELEASED",
  "SHIPMENT_DELIVERED",
  "KYC_VERIFIED",
  "KYC_PENDING",
  "LOAN_DECIDED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type DomainEvent<Payload = Record<string, unknown>> = {
  type: EventType;
  organizationId?: string | null;
  actorProfileId?: string | null;
  payload: Payload;
};
