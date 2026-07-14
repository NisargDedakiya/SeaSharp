import "server-only";
import { eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { domainEvents, workflowHistory, workflowInstances, shipments } from "@/db/schema";

// The legal-grade audit trail: a pure read model merging domain_events
// (the cross-domain event log, src/db/schema/events.ts) with workflow_history
// (the per-transition record, src/db/schema/workflow.ts) into one
// chronological timeline for a single entity. Neither table is written to
// here — see drizzle/manual/09_audit_immutability.sql for how they're locked
// against UPDATE/DELETE at the database level.
//
// Every trade-lifecycle table today is ultimately keyed on an RFQ (workflow
// instances are 1:1 with rfqs, shipments are 1:1 with rfqs via
// shipments.rfq_id unique), so "the entity" this timeline is built around is
// always resolved down to an rfqId, then every domain_events row whose
// payload names that rfqId (payload->>'rfqId') and every workflow_history
// row for that rfq's workflow_instances row are merged and sorted.
export const AUDIT_ENTITY_TYPES = ["rfq", "shipment"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export type TimelineEntry = {
  timestamp: Date;
  actor: { profileId: string | null; name: string | null };
  type: string;
  description: string;
  payload: Record<string, unknown> | null;
};

// Resolves any supported entity reference down to the rfqId every
// underlying table is keyed on. Returns null if the entity doesn't exist —
// callers should treat that as "no timeline" (404), not an empty array.
export async function resolveRfqId(entityType: AuditEntityType, entityId: string): Promise<string | null> {
  if (entityType === "rfq") return entityId;

  // entityType === "shipment"
  const shipment = await serviceDb.query.shipments.findFirst({
    where: eq(shipments.id, entityId),
  });
  return shipment?.rfqId ?? null;
}

function describeDomainEvent(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "RFQ_CREATED":
      return "RFQ created";
    case "BID_SUBMITTED":
      return "Bid submitted";
    case "RFQ_AWARDED":
      return "RFQ awarded to winning bid";
    case "DEAL_CONFIRMED":
      return "Deal confirmed by importer";
    case "FUNDING_REQUESTED":
      return `Funding requested from investors${payload.requestedAmount ? `: $${payload.requestedAmount}` : ""}`;
    case "FUNDING_REQUEST_FUNDED":
      return "Funding request funded by an investor";
    case "ESCROW_MILESTONE_RELEASED":
      return `Escrow milestone released${payload.milestone ? `: ${payload.milestone}` : ""}`;
    case "SHIPMENT_DELIVERED":
      return "Shipment delivered";
    case "KYC_VERIFIED":
      return "KYC verified";
    case "KYC_PENDING":
      return "KYC submitted, pending review";
    case "LOAN_DECIDED":
      return `Loan request ${payload.approved ? "approved" : "rejected"}`;
    case "WORKFLOW_TRANSITIONED":
      // Workflow transitions are also recorded via workflow_history below;
      // this domain_events row is the cross-domain notification/audit
      // fan-out copy of the same transition, so it's included with a
      // parallel description rather than deduped away (each row has its
      // own id/timestamp/source table, which matters for a legal audit trail).
      return `Workflow transitioned: ${payload.fromNode ?? "?"} -> ${payload.toNode ?? "?"}`;
    default:
      return type;
  }
}

async function actorNamesFor(profileIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(profileIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();
  const rows = await serviceDb.query.profiles.findMany({
    where: (p, { inArray }) => inArray(p.id, ids),
  });
  return new Map(rows.map((p) => [p.id, p.fullName]));
}

// Builds the merged, chronological timeline for one entity. Returns null if
// the entity can't be resolved (no such rfq/shipment) so the route can 404.
export async function getAuditTimeline(
  entityType: AuditEntityType,
  entityId: string
): Promise<TimelineEntry[] | null> {
  const rfqId = await resolveRfqId(entityType, entityId);
  if (!rfqId) return null;

  const events = await serviceDb.query.domainEvents.findMany({
    where: sql`${domainEvents.payload}->>'rfqId' = ${rfqId}`,
    orderBy: (e, { asc }) => [asc(e.createdAt)],
  });

  const historyRows = await serviceDb
    .select({
      createdAt: workflowHistory.createdAt,
      fromNode: workflowHistory.fromNode,
      toNode: workflowHistory.toNode,
      actorProfileId: workflowHistory.actorProfileId,
      metadata: workflowHistory.metadata,
    })
    .from(workflowHistory)
    .innerJoin(workflowInstances, eq(workflowHistory.workflowInstanceId, workflowInstances.id))
    .where(eq(workflowInstances.rfqId, rfqId))
    .orderBy(workflowHistory.createdAt);

  const actorNames = await actorNamesFor([
    ...events.map((e) => e.actorProfileId),
    ...historyRows.map((h) => h.actorProfileId),
  ]);

  const eventEntries: TimelineEntry[] = events.map((e) => ({
    timestamp: e.createdAt,
    actor: { profileId: e.actorProfileId, name: e.actorProfileId ? actorNames.get(e.actorProfileId) ?? null : null },
    type: e.type,
    description: describeDomainEvent(e.type, (e.payload as Record<string, unknown>) ?? {}),
    payload: (e.payload as Record<string, unknown>) ?? null,
  }));

  const historyEntries: TimelineEntry[] = historyRows.map((h) => ({
    timestamp: h.createdAt,
    actor: {
      profileId: h.actorProfileId,
      name: h.actorProfileId ? actorNames.get(h.actorProfileId) ?? null : null,
    },
    type: "WORKFLOW_HISTORY",
    description: `Workflow step: ${h.fromNode} -> ${h.toNode}`,
    payload: (h.metadata as Record<string, unknown>) ?? null,
  }));

  return [...eventEntries, ...historyEntries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}
