import "server-only";
import { eq, or, desc, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { deals, rfqs, bids, organizations, escrowAccounts, fundingRequests } from "@/db/schema";
import { AppError } from "@/lib/api-handler";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { emit } from "@/core/events";
import type { AuthenticatedActor } from "@/core/identity/session";

export type DealListItem = {
  id: string;
  rfqId: string;
  product: string;
  totalValue: number;
  currency: string;
  status: string;
  confirmedAt: Date;
  importer: { id: string; name: string };
  exporter: { id: string; name: string };
  // The deal's investor-financing state, so the dashboard can show
  // "Request funding" only where no request is already open/funded.
  fundingRequest: {
    id: string;
    kind: string;
    requestedAmount: number;
    status: string;
  } | null;
};

// Deal confirmation: the importer's explicit "yes, this trade is on" for an
// awarded RFQ. Award (rfqs/[id]/award) already locked escrow and accepted
// the winning bid; confirming records the commercial deal between the two
// parties, which is what the exporter's dashboard lists and what
// investor-directed funding requests (src/core/finance/funding.ts) hang off.
export async function confirmDeal(rfqId: string, actor: AuthenticatedActor) {
  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  if (!rfq) {
    throw new AppError(404, "RFQ not found.");
  }
  if (rfq.organizationId !== actor.organization.id) {
    throw new AppError(403, "Only the importer who owns this RFQ can confirm the deal.");
  }
  // FULFILLED is allowed too: an RFQ whose escrow already fully released is
  // still a real, confirmable deal the exporter can raise financing against.
  if (rfq.status !== "AWARDED" && rfq.status !== "FULFILLED") {
    throw new AppError(409, "Only an awarded RFQ can be confirmed into a deal.");
  }
  if (!rfq.awardedBidId) {
    throw new AppError(409, "RFQ has no awarded bid to confirm.");
  }

  const existing = await serviceDb.query.deals.findFirst({ where: eq(deals.rfqId, rfq.id) });
  if (existing) {
    throw new AppError(409, "This deal has already been confirmed.");
  }

  const winningBid = await serviceDb.query.bids.findFirst({ where: eq(bids.id, rfq.awardedBidId) });
  if (!winningBid) {
    throw new AppError(404, "Awarded bid not found.");
  }

  // Deal value = what the importer actually locked in escrow at award time;
  // fall back to price x volume for any pre-escrow legacy rows.
  const escrow = await serviceDb.query.escrowAccounts.findFirst({
    where: eq(escrowAccounts.rfqId, rfq.id),
  });
  const totalValue = escrow
    ? Number(escrow.amount)
    : Math.round(Number(winningBid.pricePerUnit) * Number(rfq.volume) * 100) / 100;

  const [deal] = await serviceDb
    .insert(deals)
    .values({
      rfqId: rfq.id,
      bidId: winningBid.id,
      importerOrganizationId: rfq.organizationId,
      exporterOrganizationId: winningBid.organizationId,
      totalValue: totalValue.toString(),
      currency: rfq.currency,
      status: "CONFIRMED",
      confirmedByProfileId: actor.user.id,
    })
    .returning();

  const exporterProfileIds = await getOrganizationMemberProfileIds(winningBid.organizationId);
  await emit({
    type: "DEAL_CONFIRMED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      dealId: deal.id,
      rfqId: rfq.id,
      bidId: winningBid.id,
      totalValue,
      recipientProfileIds: exporterProfileIds,
    },
  });

  return { ...deal, totalValue: Number(deal.totalValue) };
}

// Deals where the organization is on either side of the trade — the
// exporter's dashboard lists these to unlock funding requests; the
// importer's lists the same rows read-only.
export async function listDealsForOrganization(organizationId: string): Promise<DealListItem[]> {
  const dealRows = await serviceDb.query.deals.findMany({
    where: or(
      eq(deals.exporterOrganizationId, organizationId),
      eq(deals.importerOrganizationId, organizationId)
    ),
    orderBy: [desc(deals.confirmedAt)],
  });
  if (dealRows.length === 0) return [];

  const rfqIds = dealRows.map((d) => d.rfqId);
  const orgIds = Array.from(
    new Set(dealRows.flatMap((d) => [d.importerOrganizationId, d.exporterOrganizationId]))
  );
  const dealIds = dealRows.map((d) => d.id);

  const [rfqRows, orgRows, requestRows] = await Promise.all([
    serviceDb.query.rfqs.findMany({ where: inArray(rfqs.id, rfqIds) }),
    serviceDb.query.organizations.findMany({ where: inArray(organizations.id, orgIds) }),
    serviceDb.query.fundingRequests.findMany({ where: inArray(fundingRequests.dealId, dealIds) }),
  ]);
  const rfqById = new Map(rfqRows.map((r) => [r.id, r]));
  const orgById = new Map(orgRows.map((o) => [o.id, o]));
  // Latest non-withdrawn request per deal is the one that blocks a new ask.
  const activeRequestByDealId = new Map<string, (typeof requestRows)[number]>();
  for (const request of requestRows) {
    if (request.status === "WITHDRAWN") continue;
    activeRequestByDealId.set(request.dealId, request);
  }

  return dealRows.map((d) => {
    const request = activeRequestByDealId.get(d.id) ?? null;
    return {
      id: d.id,
      rfqId: d.rfqId,
      product: rfqById.get(d.rfqId)?.product ?? "",
      totalValue: Number(d.totalValue),
      currency: d.currency,
      status: d.status,
      confirmedAt: d.confirmedAt,
      importer: {
        id: d.importerOrganizationId,
        name: orgById.get(d.importerOrganizationId)?.name ?? "",
      },
      exporter: {
        id: d.exporterOrganizationId,
        name: orgById.get(d.exporterOrganizationId)?.name ?? "",
      },
      fundingRequest: request
        ? {
            id: request.id,
            kind: request.kind,
            requestedAmount: Number(request.requestedAmount),
            status: request.status,
          }
        : null,
    };
  });
}
