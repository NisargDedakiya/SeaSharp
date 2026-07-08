import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { workflowDefinitions, workflowInstances, workflowHistory } from "@/db/schema";
import { emit } from "@/core/events";
import { assertTransition } from "./trade-workflow";

// The single source of truth for "where is this trade right now," replacing
// the three independent state machines described in trade-workflow.ts's
// header comment (rfqs.status, escrow_milestones, shipments.transportStage).
//
// The full aspirational lifecycle (see docs/02-product-requirements.md §
// Marketplace) is:
//
//   INQUIRY -> OPEN -> NEGOTIATION -> CONTRACT -> AWARDED -> PRODUCTION ->
//   WAREHOUSE -> PICKUP -> EXPORT_CUSTOMS -> SHIPPING -> IMPORT_CUSTOMS ->
//   CUSTOMS_CLEARED -> DELIVERY -> PAYMENT -> FULFILLED
//
// Only a slice of that has real tables/routes behind it today (RFQ
// award, escrow milestone release, shipment transport stage). Rather than
// only encoding the implemented slice, the graph below also allows the
// direct shortcuts the current code actually takes (e.g. OPEN -> AWARDED,
// AWARDED -> PICKUP) alongside the not-yet-wired intermediate nodes
// (NEGOTIATION, CONTRACT, PRODUCTION, WAREHOUSE, EXPORT_CUSTOMS, SHIPPING,
// IMPORT_CUSTOMS, PAYMENT) — so wiring up Negotiation/Contract/Production
// later is a matter of routes calling advance() through the finer-grained
// path, not a new graph or a new set of tables.
export const TRADE_LIFECYCLE_GRAPH: Record<string, string[]> = {
  INQUIRY: ["OPEN"],
  OPEN: ["NEGOTIATION", "AWARDED", "CANCELLED"],
  NEGOTIATION: ["CONTRACT", "CANCELLED"],
  CONTRACT: ["AWARDED", "CANCELLED"],
  // AWARDED -> PICKUP is the shortcut today's award/escrow routes take:
  // Production/Warehouse have no table/route yet (see trade-workflow.ts).
  AWARDED: ["PRODUCTION", "PICKUP"],
  PRODUCTION: ["WAREHOUSE"],
  WAREHOUSE: ["PICKUP"],
  // PICKUP -> CUSTOMS_CLEARED is the shortcut: today's single "Customs
  // Cleared" escrow milestone doesn't distinguish export vs. import customs
  // or the transit leg between them.
  PICKUP: ["EXPORT_CUSTOMS", "CUSTOMS_CLEARED"],
  EXPORT_CUSTOMS: ["SHIPPING"],
  SHIPPING: ["IMPORT_CUSTOMS"],
  IMPORT_CUSTOMS: ["CUSTOMS_CLEARED"],
  // DELIVERY -> FULFILLED is the shortcut: payment processing isn't a
  // separate step yet — escrow release doubles as final payment.
  CUSTOMS_CLEARED: ["DELIVERY"],
  DELIVERY: ["PAYMENT", "FULFILLED"],
  PAYMENT: ["FULFILLED"],
  FULFILLED: [],
  CANCELLED: [],
};

export const TRADE_LIFECYCLE_DEFINITION_NAME = "trade-lifecycle";
export const TRADE_LIFECYCLE_DEFINITION_VERSION = 1;

type Tx = Parameters<Parameters<typeof serviceDb.transaction>[0]>[0];

async function getOrCreateDefinition(tx: Tx) {
  const existing = await tx.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.name, TRADE_LIFECYCLE_DEFINITION_NAME),
    orderBy: (definitions, { desc }) => [desc(definitions.version)],
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(workflowDefinitions)
    .values({
      name: TRADE_LIFECYCLE_DEFINITION_NAME,
      version: TRADE_LIFECYCLE_DEFINITION_VERSION,
      graph: TRADE_LIFECYCLE_GRAPH,
    })
    .returning();
  return created;
}

async function getOrCreateInstance(
  tx: Tx,
  params: { rfqId: string; organizationId: string; initialNode: string }
) {
  const existing = await tx.query.workflowInstances.findFirst({
    where: eq(workflowInstances.rfqId, params.rfqId),
  });
  if (existing) return existing;

  const definition = await getOrCreateDefinition(tx);
  const [created] = await tx
    .insert(workflowInstances)
    .values({
      workflowDefinitionId: definition.id,
      rfqId: params.rfqId,
      organizationId: params.organizationId,
      currentNode: params.initialNode,
    })
    .returning();
  return created;
}

export type AdvanceParams = {
  /** The RFQ this trade's workflow instance is keyed on. */
  rfqId: string;
  organizationId: string;
  toNode: string;
  actorProfileId?: string | null;
  /** Node to seed a brand-new instance at, if this RFQ has none yet. Defaults to "OPEN". */
  initialNode?: string;
  metadata?: Record<string, unknown>;
  subject?: string;
};

export type AdvanceResult = {
  instanceId: string;
  rfqId: string;
  fromNode: string;
  toNode: string;
};

// The transactional half of advance(): validates the move against the
// definition's graph, updates workflow_instances.currentNode, and writes an
// immutable workflow_history row. Callers that already have their own
// serviceDb.transaction() (award/route.ts, escrow/release/route.ts) call
// this with their own `tx` so the workflow move commits atomically with
// their other writes (rfqs.status, escrow_milestones, shipments), instead of
// opening a second transaction.
export async function advanceInTx(tx: Tx, params: AdvanceParams): Promise<AdvanceResult> {
  const instance = await getOrCreateInstance(tx, {
    rfqId: params.rfqId,
    organizationId: params.organizationId,
    initialNode: params.initialNode ?? "OPEN",
  });

  const definition = await tx.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, instance.workflowDefinitionId),
  });
  const graph = (definition?.graph as Record<string, string[]> | undefined) ?? TRADE_LIFECYCLE_GRAPH;

  assertTransition(graph, instance.currentNode, params.toNode, params.subject ?? "trade workflow");

  await tx
    .update(workflowInstances)
    .set({ currentNode: params.toNode, updatedAt: new Date() })
    .where(eq(workflowInstances.id, instance.id));

  await tx.insert(workflowHistory).values({
    workflowInstanceId: instance.id,
    organizationId: params.organizationId,
    fromNode: instance.currentNode,
    toNode: params.toNode,
    actorProfileId: params.actorProfileId ?? null,
    metadata: params.metadata ?? null,
  });

  return {
    instanceId: instance.id,
    rfqId: params.rfqId,
    fromNode: instance.currentNode,
    toNode: params.toNode,
  };
}

// Emits the WORKFLOW_TRANSITIONED domain event for a completed advance().
// Split out from advanceInTx so callers who fold the transition into a
// larger business transaction (award/release routes) can call this after
// that transaction commits — mirrors how those routes already call emit()
// only once their serviceDb.transaction() has resolved (see
// src/core/events/bus.ts's "never roll back on subscriber failure" note).
export async function emitTransition(
  result: AdvanceResult,
  actor: { organizationId: string; profileId?: string | null },
  extraPayload: Record<string, unknown> = {}
): Promise<void> {
  await emit({
    type: "WORKFLOW_TRANSITIONED",
    organizationId: actor.organizationId,
    actorProfileId: actor.profileId ?? null,
    payload: {
      workflowInstanceId: result.instanceId,
      rfqId: result.rfqId,
      fromNode: result.fromNode,
      toNode: result.toNode,
      ...extraPayload,
    },
  });
}

// Standalone convenience wrapper for callers that don't already have a
// transaction of their own: opens one, performs the transition, and emits
// the resulting domain event. Prefer advanceInTx() + emitTransition() when
// folding a transition into an existing business transaction.
export async function advance(
  params: AdvanceParams,
  extraPayload: Record<string, unknown> = {}
): Promise<AdvanceResult> {
  const result = await serviceDb.transaction((tx) => advanceInTx(tx, params));
  await emitTransition(result, { organizationId: params.organizationId, profileId: params.actorProfileId }, extraPayload);
  return result;
}
