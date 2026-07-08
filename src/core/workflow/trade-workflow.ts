import { AppError } from "@/lib/api-handler";

// The trade lifecycle:
//
//   Inquiry -> RFQ -> Negotiation -> Contract -> Production -> Warehouse ->
//   Pickup -> Export Customs -> Shipping -> Import Customs -> Delivery -> Payment
//
// This used to be split across three separate state fields with no unified
// instance (rfqs.status, escrow_milestones, shipments.transportStage). It
// now has one: src/core/workflow/engine.ts's `workflow_instances` +
// TRADE_LIFECYCLE_GRAPH is the single source of truth, and
// award/route.ts + escrow/release/route.ts call `advanceInTx()` there
// instead of driving these functions directly.
//
// This module's `assertTransition()` is still the one place that decides
// "is this move even legal" — engine.ts calls it against a
// workflow_definitions.graph instead of a hardcoded object. RFQ_TRANSITIONS
// and assertRfqTransition/assertSequentialAdvance are kept as thin,
// independently-testable wrappers around the same rule, and as a fallback
// for any code that only cares about the RFQ-status/sequential-index slice
// without touching a workflow_instances row.

/** Generic directed transition graph: assert `to` is reachable from `from`. */
export function assertTransition(
  graph: Record<string, readonly string[]>,
  from: string,
  to: string,
  subject: string
): void {
  const allowed = graph[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(409, `Cannot move ${subject} from ${from} to ${to}.`);
  }
}

// RFQ lifecycle: an RFQ opens for bidding, is awarded to exactly one bid or
// cancelled, and an awarded RFQ is fulfilled once its escrow fully releases
// (see src/app/api/escrow/[id]/release/route.ts). There is no path back to
// OPEN — award and cancellation are both one-way doors.
export const RFQ_TRANSITIONS = {
  OPEN: ["AWARDED", "CANCELLED"],
  AWARDED: ["FULFILLED"],
  FULFILLED: [],
  CANCELLED: [],
} as const;

export function assertRfqTransition(from: string, to: string): void {
  assertTransition(RFQ_TRANSITIONS, from, to, "RFQ");
}

// Escrow milestones and shipment transport stages are both strictly
// sequential (see ESCROW_MILESTONES in src/core/finance/escrow.ts and
// transportStageEnum in src/db/schema/logistics.ts) — there's no branching,
// only "the next one in order." This is the shared rule both
// award/route.ts (seeding milestones) and escrow/release/route.ts
// (progressing them) rely on.
export function assertSequentialAdvance(currentIndex: number, targetIndex: number, subject: string): void {
  if (targetIndex !== currentIndex + 1) {
    throw new AppError(
      409,
      `Cannot advance ${subject} out of order (currently at step ${currentIndex}, requested step ${targetIndex}).`
    );
  }
}
