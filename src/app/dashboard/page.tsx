import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { recalculateAndSaveSts, STS_TIER_LABELS } from "@/lib/sts";
import { KycPanel } from "@/components/dashboard/KycPanel";
import { LoanPanel } from "@/components/dashboard/LoanPanel";
import { StsBadge } from "@/components/StsBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  if (user.role === "EXPORTER") {
    const breakdown = await recalculateAndSaveSts(user.id);

    const bids = await prisma.bid.findMany({
      where: { exporterId: user.id },
      include: { rfq: true },
      orderBy: { createdAt: "desc" },
    });

    const awardedRfqs = await prisma.rfq.findMany({
      where: { shipment: { exporterId: user.id }, status: { in: ["AWARDED", "FULFILLED"] } },
      include: { escrow: true },
    });

    const loans = await prisma.tradeLoan.findMany({
      where: { exporterId: user.id },
      orderBy: { requestedAt: "desc" },
    });

    const loanedRfqIds = new Set(loans.map((l) => l.rfqId));
    const eligibleRfqs = awardedRfqs
      .filter((r) => r.escrow && !loanedRfqIds.has(r.id))
      .map((r) => ({ id: r.id, product: r.product, escrowAmount: r.escrow!.amount }));

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
          <LoanPanel eligibleRfqs={eligibleRfqs} loans={loans} />
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="font-semibold text-slate-100">My Bids</h2>
          {bids.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No bids yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bids.map((bid) => (
                <li key={bid.id}>
                  <Link href={`/marketplace/${bid.rfqId}`} className="text-sm text-slate-300 hover:text-emerald-400">
                    {bid.rfq.product} — ${bid.pricePerUnit}/{bid.rfq.unit} · {bid.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    );
  }

  // Importer dashboard
  const rfqs = await prisma.rfq.findMany({
    where: { importerId: user.id },
    include: { _count: { select: { bids: true } } },
    orderBy: { createdAt: "desc" },
  });

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
            {rfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link href={`/marketplace/${rfq.id}`} className="text-sm text-slate-300 hover:text-emerald-400">
                  {rfq.product} — {rfq.status} · {rfq._count.bids} bids
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
