import "server-only";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { deals, fundingRequests, rfqs, organizations } from "@/db/schema";
import { AppError } from "@/lib/api-handler";
import { getOrganizationMemberProfileIds } from "@/core/identity/organizations";
import { emit } from "@/core/events";
import type { AuthenticatedActor } from "@/core/identity/session";

export const FUNDING_REQUEST_KINDS = ["LOAN", "ADVANCE"] as const;
export type FundingRequestKind = (typeof FUNDING_REQUEST_KINDS)[number];

// Org types allowed to fund an open request — the two capital-provider
// roles in organizationTypeEnum (src/db/schema/identity.ts).
const FUNDER_ORG_TYPES = new Set(["INVESTOR", "FINANCE_PARTNER"]);

export type FundingOpportunity = {
  id: string;
  kind: string;
  requestedAmount: number;
  currency: string;
  note: string | null;
  requestedAt: Date;
  deal: {
    id: string;
    product: string;
    totalValue: number;
    importerName: string;
  };
  exporter: { id: string; name: string; stsScore: number; kycStatus: string };
};

// Exporter raises an investor-directed ask (loan or funds advance) against
// one of their confirmed deals. The confirmed deal is the collateral story:
// the importer has already committed, so the request carries the deal's
// value and the exporter's STS for the investor to judge.
export async function createFundingRequest(
  params: { dealId: string; kind: FundingRequestKind; requestedAmount: number; note?: string },
  actor: AuthenticatedActor
) {
  if (actor.organization.type !== "EXPORTER") {
    throw new AppError(403, "Only exporters can request funding against a deal.");
  }

  const deal = await serviceDb.query.deals.findFirst({ where: eq(deals.id, params.dealId) });
  if (!deal || deal.exporterOrganizationId !== actor.organization.id) {
    throw new AppError(404, "No confirmed deal found for this exporter.");
  }
  if (deal.status !== "CONFIRMED") {
    throw new AppError(409, "Funding can only be requested against a confirmed deal.");
  }
  if (params.requestedAmount > Number(deal.totalValue)) {
    throw new AppError(400, "Requested amount cannot exceed the deal value.");
  }

  const activeRequest = await serviceDb.query.fundingRequests.findFirst({
    where: and(eq(fundingRequests.dealId, deal.id), ne(fundingRequests.status, "WITHDRAWN")),
  });
  if (activeRequest) {
    throw new AppError(409, "This deal already has an active funding request.");
  }

  const [request] = await serviceDb
    .insert(fundingRequests)
    .values({
      dealId: deal.id,
      exporterOrganizationId: actor.organization.id,
      kind: params.kind,
      requestedAmount: params.requestedAmount.toString(),
      currency: deal.currency,
      note: params.note ?? null,
      status: "OPEN",
    })
    .returning();

  await emit({
    type: "FUNDING_REQUESTED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      fundingRequestId: request.id,
      dealId: deal.id,
      rfqId: deal.rfqId,
      kind: request.kind,
      requestedAmount: params.requestedAmount,
      recipientProfileIds: [actor.user.id],
    },
  });

  return { ...request, requestedAmount: Number(request.requestedAmount) };
}

// The investor-facing marketplace of OPEN asks, newest first — backs the
// Funding Opportunities dashboard widget for INVESTOR / FINANCE_PARTNER.
export async function listOpenFundingRequests(): Promise<FundingOpportunity[]> {
  const requests = await serviceDb.query.fundingRequests.findMany({
    where: eq(fundingRequests.status, "OPEN"),
    orderBy: [desc(fundingRequests.requestedAt)],
  });
  if (requests.length === 0) return [];

  const dealRows = await serviceDb.query.deals.findMany({
    where: inArray(
      deals.id,
      requests.map((r) => r.dealId)
    ),
  });
  const dealById = new Map(dealRows.map((d) => [d.id, d]));

  const rfqIds = dealRows.map((d) => d.rfqId);
  const orgIds = Array.from(
    new Set(dealRows.flatMap((d) => [d.exporterOrganizationId, d.importerOrganizationId]))
  );
  const [rfqRows, orgRows] = await Promise.all([
    rfqIds.length ? serviceDb.query.rfqs.findMany({ where: inArray(rfqs.id, rfqIds) }) : [],
    orgIds.length
      ? serviceDb.query.organizations.findMany({ where: inArray(organizations.id, orgIds) })
      : [],
  ]);
  const rfqById = new Map(rfqRows.map((r) => [r.id, r]));
  const orgById = new Map(orgRows.map((o) => [o.id, o]));

  return requests.flatMap((request) => {
    const deal = dealById.get(request.dealId);
    if (!deal) return [];
    const exporter = orgById.get(deal.exporterOrganizationId);
    return [
      {
        id: request.id,
        kind: request.kind,
        requestedAmount: Number(request.requestedAmount),
        currency: request.currency,
        note: request.note,
        requestedAt: request.requestedAt,
        deal: {
          id: deal.id,
          product: rfqById.get(deal.rfqId)?.product ?? "",
          totalValue: Number(deal.totalValue),
          importerName: orgById.get(deal.importerOrganizationId)?.name ?? "",
        },
        exporter: {
          id: deal.exporterOrganizationId,
          name: exporter?.name ?? "",
          stsScore: exporter?.stsScore ?? 0,
          kycStatus: exporter?.kycStatus ?? "UNVERIFIED",
        },
      },
    ];
  });
}

// Investor / finance partner commits to an OPEN request. Phase 1 scope:
// this records who funded what and notifies the exporter — actual money
// movement (wallet credit / disbursement rails) is a follow-up, same as
// trade_loans' FUNDED->REPAID lifecycle.
export async function fundRequest(fundingRequestId: string, actor: AuthenticatedActor) {
  if (!FUNDER_ORG_TYPES.has(actor.organization.type)) {
    throw new AppError(403, "Only investors and finance partners can fund a request.");
  }

  const request = await serviceDb.query.fundingRequests.findFirst({
    where: eq(fundingRequests.id, fundingRequestId),
  });
  if (!request) {
    throw new AppError(404, "Funding request not found.");
  }
  if (request.status !== "OPEN") {
    throw new AppError(409, "This funding request is no longer open.");
  }

  // Guard the OPEN->FUNDED flip with a status-conditioned UPDATE so two
  // investors racing on the same request can't both win.
  const [funded] = await serviceDb
    .update(fundingRequests)
    .set({
      status: "FUNDED",
      funderOrganizationId: actor.organization.id,
      fundedAt: new Date(),
    })
    .where(and(eq(fundingRequests.id, request.id), eq(fundingRequests.status, "OPEN")))
    .returning();
  if (!funded) {
    throw new AppError(409, "This funding request is no longer open.");
  }

  const deal = await serviceDb.query.deals.findFirst({ where: eq(deals.id, request.dealId) });
  const exporterProfileIds = await getOrganizationMemberProfileIds(request.exporterOrganizationId);
  await emit({
    type: "FUNDING_REQUEST_FUNDED",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: {
      fundingRequestId: funded.id,
      dealId: request.dealId,
      rfqId: deal?.rfqId,
      requestedAmount: Number(funded.requestedAmount),
      funderOrganizationId: actor.organization.id,
      recipientProfileIds: exporterProfileIds,
    },
  });

  return { ...funded, requestedAmount: Number(funded.requestedAmount) };
}

// Exporter's own requests (any status), newest first — shown alongside
// their deals on the dashboard.
export async function listFundingRequestsForExporter(organizationId: string) {
  const rows = await serviceDb.query.fundingRequests.findMany({
    where: eq(fundingRequests.exporterOrganizationId, organizationId),
    orderBy: [desc(fundingRequests.requestedAt)],
  });
  return rows.map((r) => ({ ...r, requestedAmount: Number(r.requestedAmount) }));
}
