import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { rfqs, organizations, bids, escrowAccounts, shipments } from "@/db/schema";
import { getSessionUser } from "@/core/identity/session";

// Blind bidding: the RFQ owner (importer) sees every bid to decide who to
// award. Exporters only ever see their own bid price plus the total bid
// count — never competitors' prices — so market pricing stays protected
// until the deal is done.
export const GET = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const user = await getSessionUser();

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, params.id) });
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }
  const importer = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, rfq.organizationId),
  });
  if (!importer) throw new AppError(404, "RFQ not found.");

  const allBids = await serviceDb.query.bids.findMany({
    where: eq(bids.rfqId, rfq.id),
    orderBy: (b, { asc }) => [asc(b.createdAt)],
  });
  const escrow = await serviceDb.query.escrowAccounts.findFirst({
    where: eq(escrowAccounts.rfqId, rfq.id),
  });
  const shipment = await serviceDb.query.shipments.findFirst({ where: eq(shipments.rfqId, rfq.id) });

  // The viewer's own membership determines which bids they can see — we
  // don't have a session-scoped org lookup here (this route is reachable
  // signed-out), so compare against every org the signed-in profile belongs
  // to isn't needed: bidding/ownership is always 1 org per profile in this
  // phase, so we resolve it the same way getCurrentOrganization does.
  const viewerMembership = user
    ? await serviceDb.query.organizationMembers.findFirst({
        where: (m, { eq: eqOp }) => eqOp(m.profileId, user.id),
      })
    : null;
  const viewerOrgId = viewerMembership?.organizationId ?? null;
  const isOwner = viewerOrgId === rfq.organizationId;

  const bidOrgIds = Array.from(new Set(allBids.map((b) => b.organizationId)));
  const bidOrgs = bidOrgIds.length
    ? await serviceDb.query.organizations.findMany({
        where: (o, { inArray }) => inArray(o.id, bidOrgIds),
      })
    : [];
  const orgById = new Map(bidOrgs.map((o) => [o.id, o]));

  const visibleBids = isOwner ? allBids : allBids.filter((b) => b.organizationId === viewerOrgId);

  const bidsOut = visibleBids.map((b) => {
    const org = orgById.get(b.organizationId);
    return {
      id: b.id,
      pricePerUnit: Number(b.pricePerUnit),
      message: b.message,
      aiSuggestedPrice: b.aiSuggestedPrice ? Number(b.aiSuggestedPrice) : null,
      status: b.status,
      exporter: { id: org?.id, name: org?.name, companyName: org?.name, stsScore: org?.stsScore ?? 0 },
    };
  });

  return NextResponse.json({
    id: rfq.id,
    product: rfq.product,
    hsCode: rfq.hsCode,
    originCountry: rfq.originCountry,
    destinationCountry: rfq.destinationCountry,
    volume: Number(rfq.volume),
    unit: rfq.unit,
    targetPricePerUnit: Number(rfq.targetPricePerUnit),
    currency: rfq.currency,
    deadline: rfq.deadline,
    status: rfq.status,
    importer: { id: importer.id, name: importer.name, companyName: importer.name },
    bids: bidsOut,
    escrow: escrow
      ? { id: escrow.id, amount: Number(escrow.amount), currency: escrow.currency, status: escrow.status }
      : null,
    shipment: shipment
      ? {
          exporterId: shipment.exporterOrganizationId,
          mode: shipment.mode,
          aiRouteRecommendation: shipment.aiRouteRecommendation,
          estimatedCost: Number(shipment.estimatedCost),
        }
      : null,
    totalBidCount: allBids.length,
  });
});
