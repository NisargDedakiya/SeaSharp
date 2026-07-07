import { AppError } from "@/lib/api-handler";

// The trade lifecycle a workflow engine should eventually own end to end:
//
//   Inquiry -> RFQ -> Negotiation -> Contract -> Production -> Warehouse ->
//   Pickup -> Export Customs -> Shipping -> Import Customs -> Delivery -> Payment
//
// Today only a slice of this is implemented, split across three separate
// state fields rather than one unified workflow instance:
//   - rfqs.status            (RFQ / award stage)
//   - escrow_milestones      (funding-to-delivery checkpoints)
//   - shipments.transportStage (physical movement stage)
// This module is the first step toward unifying them: it centralizes the
// *rules* for valid transitions so routes call `assertTransition()` instead
// of re-deriving "is this move even legal" inline. Negotiation, Contract,
// and Production/Warehouse stages aren't wired to any table yet (see
// docs/02-product-requirements.md § Marketplace) — they're it's the next
// thing to fold into this engine, not new tables re-implementing the same
// state.

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
