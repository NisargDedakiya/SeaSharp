import "server-only";
import { eq, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { rfqs, escrowAccounts, shipments, tradeLoans } from "@/db/schema";

export type EligibleFinancingRfq = { id: string; product: string; escrowAmount: number };

// RFQs this organization can request trade financing against: an
// awarded-or-fulfilled RFQ with funded escrow, on whichever side of the
// deal this org sits — the exporter who won the bid (pre-shipment
// "buy to export" financing) or the importer who posted the RFQ
// (import-purchase "buy to resell domestically" financing) — that doesn't
// already have a loan request against it. Shared by the dashboard's LOAN
// widget listing and POST /api/loans's server-side re-verification of a
// submitted rfqId.
export async function getEligibleFinancingRfqs(
  organizationId: string,
  organizationType: string
): Promise<EligibleFinancingRfq[]> {
  const awardedRfqs =
    organizationType === "IMPORTER"
      ? await serviceDb.query.rfqs.findMany({
          where: (r, { eq: eqOp, and: andOp, or: orOp }) =>
            andOp(eqOp(r.organizationId, organizationId), orOp(eqOp(r.status, "AWARDED"), eqOp(r.status, "FULFILLED"))),
        })
      : await (async () => {
          const orgShipments = await serviceDb.query.shipments.findMany({
            where: eq(shipments.exporterOrganizationId, organizationId),
          });
          const shipmentRfqIds = orgShipments.map((s) => s.rfqId);
          return shipmentRfqIds.length
            ? serviceDb.query.rfqs.findMany({
                where: (r, { inArray: inArrayOp, and: andOp, or: orOp, eq: eqOp }) =>
                  andOp(inArrayOp(r.id, shipmentRfqIds), orOp(eqOp(r.status, "AWARDED"), eqOp(r.status, "FULFILLED"))),
              })
            : [];
        })();

  const escrows = awardedRfqs.length
    ? await serviceDb.query.escrowAccounts.findMany({
        where: inArray(
          escrowAccounts.rfqId,
          awardedRfqs.map((r) => r.id)
        ),
      })
    : [];
  const escrowByRfqId = new Map(escrows.map((e) => [e.rfqId, e]));

  const existingLoans = await serviceDb.query.tradeLoans.findMany({
    where: eq(tradeLoans.requestingOrganizationId, organizationId),
  });
  const loanedRfqIds = new Set(existingLoans.filter((l) => l.rfqId).map((l) => l.rfqId!));

  return awardedRfqs
    .filter((r) => escrowByRfqId.has(r.id) && !loanedRfqIds.has(r.id))
    .map((r) => ({ id: r.id, product: r.product, escrowAmount: Number(escrowByRfqId.get(r.id)!.amount) }));
}

// Re-verifies a specific rfqId is valid collateral for this org's financing
// request — the same rule getEligibleFinancingRfqs lists, checked again at
// request time so a client can't submit an rfqId it was never offered.
export async function verifyFinancingCollateral(params: {
  rfqId: string;
  organizationId: string;
  organizationType: string;
}): Promise<{ escrowAmount: number } | null> {
  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, params.rfqId) });
  if (!rfq) return null;
  const escrow = await serviceDb.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.rfqId, rfq.id) });
  if (!escrow) return null;

  if (params.organizationType === "IMPORTER") {
    if (rfq.organizationId !== params.organizationId) return null;
  } else {
    const shipment = await serviceDb.query.shipments.findFirst({ where: eq(shipments.rfqId, rfq.id) });
    if (shipment?.exporterOrganizationId !== params.organizationId) return null;
  }

  return { escrowAmount: Number(escrow.amount) };
}
