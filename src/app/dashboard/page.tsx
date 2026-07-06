import Link from "next/link";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/mongoose";
import { User, Bid, Rfq, Shipment, Escrow, TradeLoan } from "@/models";
import { getSessionUser } from "@/lib/session";
import { STS_TIER_LABELS } from "@/lib/sts";
import { recalculateAndSaveSts } from "@/lib/sts-server";
import { KycPanel } from "@/components/dashboard/KycPanel";
import { LoanPanel } from "@/components/dashboard/LoanPanel";
import { StsBadge } from "@/components/StsBadge";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  await dbConnect();
  const user = await User.findById(sessionUser.id).orFail();

  if (user.role === "EXPORTER") {
    const breakdown = await recalculateAndSaveSts(user._id.toString());

    const bids = await Bid.find({ exporterId: user._id })
      .populate("rfqId", "product unit")
      .sort({ createdAt: -1 });

    const exporterShipments = await Shipment.find({ exporterId: user._id });
    const shipmentRfqIds = exporterShipments.map((s) => s.rfqId);
    const awardedRfqs = await Rfq.find({
      _id: { $in: shipmentRfqIds },
      status: { $in: ["AWARDED", "FULFILLED"] },
    });
    const escrows = await Escrow.find({ rfqId: { $in: awardedRfqs.map((r) => r._id) } });
    const escrowByRfqId = new Map(escrows.map((e) => [e.rfqId.toString(), e]));

    const loans = await TradeLoan.find({ exporterId: user._id }).sort({ requestedAt: -1 });
    const loanedRfqIds = new Set(loans.filter((l) => l.rfqId).map((l) => l.rfqId!.toString()));

    const eligibleRfqs = awardedRfqs
      .filter((r) => escrowByRfqId.has(r._id.toString()) && !loanedRfqIds.has(r._id.toString()))
      .map((r) => ({
        id: r._id.toString(),
        product: r.product,
        escrowAmount: escrowByRfqId.get(r._id.toString())!.amount,
      }));

    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-50">Exporter Dashboard</h1>
        <p className="mt-1 text-slate-400">{user.companyName ?? user.name}</p>

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
          <KycPanel kycStatus={user.kycStatus} />
        </div>

        <div className="mt-6">
          <LoanPanel
            eligibleRfqs={eligibleRfqs}
            loans={
              serialize(loans) as Array<{
                id: string;
                requestedAmount: number;
                approvedAmount: number | null;
                interestRatePercent: number | null;
                riskBand: string | null;
                status: string;
              }>
            }
          />
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="font-semibold text-slate-100">My Bids</h2>
          {bids.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No bids yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bids.map((bid) => {
                const rfq = bid.rfqId as unknown as { _id: string; product: string; unit: string };
                return (
                  <li key={bid._id.toString()}>
                    <Link
                      href={`/marketplace/${rfq._id}`}
                      className="text-sm text-slate-300 hover:text-emerald-400"
                    >
                      {rfq.product} — ${bid.pricePerUnit}/{rfq.unit} · {bid.status}
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

  // Importer dashboard. Counts bids in-memory rather than via an aggregation
  // $lookup — see the comment in lib/rfqs.ts for why.
  const importerRfqs = await Rfq.find({ importerId: user._id }).sort({ createdAt: -1 });
  const importerRfqBids = await Bid.find(
    { rfqId: { $in: importerRfqs.map((r) => r._id) } },
    { rfqId: 1 }
  );
  const importerBidCountByRfqId = new Map<string, number>();
  for (const bid of importerRfqBids) {
    const key = bid.rfqId.toString();
    importerBidCountByRfqId.set(key, (importerBidCountByRfqId.get(key) ?? 0) + 1);
  }
  const rfqs = importerRfqs.map((rfq) => ({
    ...rfq.toObject(),
    bidCount: importerBidCountByRfqId.get(rfq._id.toString()) ?? 0,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Importer Dashboard</h1>
          <p className="mt-1 text-slate-400">{user.companyName ?? user.name}</p>
        </div>
        <Link
          href="/marketplace/new"
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Post an RFQ
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-slate-100">My RFQs</h2>
        {rfqs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">You haven&apos;t posted any RFQs yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(serialize(rfqs) as Array<{ id: string; product: string; status: string; bidCount: number }>).map(
              (rfq) => (
                <li key={rfq.id}>
                  <Link href={`/marketplace/${rfq.id}`} className="text-sm text-slate-300 hover:text-emerald-400">
                    {rfq.product} — {rfq.status} · {rfq.bidCount} bids
                  </Link>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
