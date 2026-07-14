// The event catalog. Every entry here is something a subscriber (audit log,
// notifications, future analytics/AI training pipelines) might care about —
// see docs/01-product-vision.md for how these compound across the platform.
export const EVENT_TYPES = [
  "RFQ_CREATED",
  "BID_SUBMITTED",
  "RFQ_AWARDED",
  // Importer confirms an awarded RFQ into a Deal (src/core/trade/deals.ts);
  // funding-request events follow the same deal (src/core/finance/funding.ts).
  "DEAL_CONFIRMED",
  "FUNDING_REQUESTED",
  "FUNDING_REQUEST_FUNDED",
  "ESCROW_MILESTONE_RELEASED",
  "SHIPMENT_DELIVERED",
  "KYC_VERIFIED",
  "KYC_PENDING",
  "LOAN_DECIDED",
  // Emitted by src/core/workflow/engine.ts#advance on every workflow_instances
  // transition — see workflow_history in src/db/schema/workflow.ts for why
  // there's no separate workflow_events table.
  "WORKFLOW_TRANSITIONED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type DomainEvent<Payload = Record<string, unknown>> = {
  type: EventType;
  organizationId?: string | null;
  actorProfileId?: string | null;
  payload: Payload;
};
