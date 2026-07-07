import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray, desc } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { bids, rfqs, shipments, escrowAccounts, tradeLoans } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { STS_TIER_LABELS } from "@/core/finance/sts";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { KycPanel } from "@/components/dashboard/KycPanel";
import { LoanPanel } from "@/components/dashboard/LoanPanel";
import { StsBadge } from "@/components/StsBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login");

  const { organization } = actor;

  if (organization.type === "EXPORTER") {
    const breakdown = await recalculateAndSaveSts(organization.id);

    const myBids = await serviceDb.query.bids.findMany({
      where: eq(bids.organizationId, organization.id),
      orderBy: [desc(bids.createdAt)],
    });
    const bidRfqIds = Array.from(new Set(myBids.map((b) => b.rfqId)));
    const bidRfqs = bidRfqIds.length
      ? await serviceDb.query.rfqs.findMany({ where: (r, { inArray: inArrayOp }) => inArrayOp(r.id, bidRfqIds) })
      : [];
    const rfqById = new Map(bidRfqs.map((r) => [r.id, r]));

    const exporterShipments = await serviceDb.query.shipments.findMany({
      where: eq(shipments.exporterOrganizationId, organization.id),
    });
    const shipmentRfqIds = exporterShipments.map((s) => s.rfqId);
    const awardedRfqs = shipmentRfqIds.length
      ? await serviceDb.query.rfqs.findMany({
          where: (r, { inArray: inArrayOp, and: andOp, or: orOp, eq: eqOp }) =>
            andOp(inArrayOp(r.id, shipmentRfqIds), orOp(eqOp(r.status, "AWARDED"), eqOp(r.status, "FULFILLED"))),
        })
      : [];
    const escrows = awardedRfqs.length
      ? await serviceDb.query.escrowAccounts.findMany({
          where: inArray(
            escrowAccounts.rfqId,
            awardedRfqs.map((r) => r.id)
          ),
        })
      : [];
    const escrowByRfqId = new Map(escrows.map((e) => [e.rfqId, e]));

    const loans = await serviceDb.query.tradeLoans.findMany({
      where: eq(tradeLoans.exporterOrganizationId, organization.id),
      orderBy: [desc(tradeLoans.requestedAt)],
    });
    const loanedRfqIds = new Set(loans.filter((l) => l.rfqId).map((l) => l.rfqId!));

    const eligibleRfqs = awardedRfqs
      .filter((r) => escrowByRfqId.has(r.id) && !loanedRfqIds.has(r.id))
      .map((r) => ({
        id: r.id,
        product: r.product,
        escrowAmount: Number(escrowByRfqId.get(r.id)!.amount),
      }));

    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-50">Exporter Dashboard</h1>
        <p className="mt-1 text-slate-400">{organization.name}</p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-100">SeaSharp Trust Score</h2>
            <StsBadge score={breakdown.totalScore} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm text-slate-400 sm:grid-cols-3">
            <dt>KYC/KYB</dt>
            <dd className="text-slate-200">{breakdown.kycPoints}/200</dd>
            <dt className="sm:hidden" />
            <dt>On-Time Delivery</dt>
            <dd className="text-slate-200">{breakdown.onTimeDeliveryPoints}/240</dd>
            <dt className="sm:hidden" />
            <dt>Escrow Speed</dt>
            <dd className="text-slate-200">{breakdown.escrowSpeedPoints}/200</dd>
            <dt className="sm:hidden" />
            <dt>Dispute Rate</dt>
            <dd className="text-slate-200">{breakdown.disputePoints}/200</dd>
            <dt className="sm:hidden" />
            <dt>Loan Repayment</dt>
            <dd className="text-slate-200">{breakdown.loanRepaymentPoints}/160</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Tier: {STS_TIER_LABELS[breakdown.tier]}
          </p>
        </div>

        <div className="mt-6">
          <KycPanel kycStatus={organization.kycStatus} />
        </div>

        <div className="mt-6">
          <LoanPanel
            eligibleRfqs={eligibleRfqs}
            loans={loans.map((l) => ({
              id: l.id,
              requestedAmount: Number(l.requestedAmount),
              approvedAmount: l.approvedAmount ? Number(l.approvedAmount) : null,
              interestRatePercent: l.interestRatePercent ? Number(l.interestRatePercent) : null,
              riskBand: l.riskBand,
              status: l.status,
            }))}
          />
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="font-semibold text-slate-100">My Bids</h2>
          {myBids.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No bids yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {myBids.map((bid) => {
                const rfq = rfqById.get(bid.rfqId);
                if (!rfq) return null;
                return (
                  <li key={bid.id}>
                    <Link href={`/marketplace/${rfq.id}`} className="text-sm text-slate-300 hover:text-sky-400">
                      {rfq.product} — ${Number(bid.pricePerUnit)}/{rfq.unit} · {bid.status}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    );
  }

  // Importer dashboard. Counts bids in-memory rather than a SQL aggregate —
  // see the comment in lib/rfqs.ts for why.
  const importerRfqs = await serviceDb.query.rfqs.findMany({
    where: eq(rfqs.organizationId, organization.id),
    orderBy: [desc(rfqs.createdAt)],
  });
  const importerRfqBids = importerRfqs.length
    ? await serviceDb
        .select({ rfqId: bids.rfqId })
        .from(bids)
        .where(
          inArray(
            bids.rfqId,
            importerRfqs.map((r) => r.id)
          )
        )
    : [];
  const importerBidCountByRfqId = new Map<string, number>();
  for (const bid of importerRfqBids) {
    importerBidCountByRfqId.set(bid.rfqId, (importerBidCountByRfqId.get(bid.rfqId) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Importer Dashboard</h1>
          <p className="mt-1 text-slate-400">{organization.name}</p>
        </div>
        <Link
          href="/marketplace/new"
          className="rounded-md bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Post an RFQ
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-slate-100">My RFQs</h2>
        {importerRfqs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">You haven&apos;t posted any RFQs yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {importerRfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link href={`/marketplace/${rfq.id}`} className="text-sm text-slate-300 hover:text-sky-400">
                  {rfq.product} — {rfq.status} · {importerBidCountByRfqId.get(rfq.id) ?? 0} bids
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
