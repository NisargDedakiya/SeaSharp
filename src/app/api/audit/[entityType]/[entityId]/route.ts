import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { rfqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuditTimeline, resolveRfqId, AUDIT_ENTITY_TYPES } from "@/core/audit/timeline";

const paramsSchema = z.object({
  entityType: z.enum(AUDIT_ENTITY_TYPES),
  entityId: z.string().uuid(),
});

// Legal-grade audit trail for disputes/compliance review: merges
// domain_events + workflow_history (see src/core/audit/timeline.ts) into one
// chronological view of a single RFQ or shipment's lifecycle. Read-only —
// nothing here ever writes to either underlying table.
//
// Scoped the same way /api/rfqs/[id] is: any signed-in member of either
// side of the trade (importer or exporter org) can pull the timeline. We
// resolve the RFQ's owning org plus its awarded exporter org the same way
// award/route.ts and rfqs/[id]/route.ts already do, rather than inventing a
// new authorization shape.
export const GET = withApiHandler<{ entityType: string; entityId: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const { entityType, entityId } = paramsSchema.parse(params);

  const timeline = await getAuditTimeline(entityType, entityId);
  if (!timeline) {
    throw new AppError(404, "No audit timeline found for that entity.");
  }

  // Authorization: resolve the underlying RFQ and confirm the signed-in
  // actor's org is either the importer (rfq owner) or the awarded exporter.
  const rfqId = await resolveRfqId(entityType, entityId);
  const rfq = rfqId
    ? await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId as string) })
    : null;

  const isImporter = rfq?.organizationId === actor.organization.id;
  const bidderOrgIds = rfq
    ? (
        await serviceDb.query.bids.findMany({
          where: (b, { eq: eqOp, and, or }) => and(eqOp(b.rfqId, rfq.id), or(eqOp(b.status, "ACCEPTED"))),
        })
      ).map((b) => b.organizationId)
    : [];
  const isAwardedExporter = bidderOrgIds.includes(actor.organization.id);

  if (!rfq || (!isImporter && !isAwardedExporter)) {
    throw new AppError(403, "You do not have access to this entity's audit timeline.");
  }

  return NextResponse.json({
    entityType,
    entityId,
    timeline,
  });
});
