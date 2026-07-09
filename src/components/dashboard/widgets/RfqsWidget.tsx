import "server-only";
import Link from "next/link";
import { eq, inArray, desc } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { bids, rfqs } from "@/db/schema";
import type { CurrentOrganization } from "@/core/identity/session";

// Real data, split by org type the same way the old fixed dashboard did:
// importers see the RFQs they posted (with bid counts), exporters see the
// RFQs they've bid on. Both are plain Drizzle reads carried over from
// dashboard/page.tsx, just relocated into a widget.
export async function RfqsWidget({ organization }: { organization: CurrentOrganization }) {
  if (organization.type === "EXPORTER") {
    const myBids = await serviceDb.query.bids.findMany({
      where: eq(bids.organizationId, organization.id),
      orderBy: [desc(bids.createdAt)],
      limit: 10,
    });
    const bidRfqIds = Array.from(new Set(myBids.map((b) => b.rfqId)));
    const bidRfqs = bidRfqIds.length
      ? await serviceDb.query.rfqs.findMany({ where: (r, { inArray: inArrayOp }) => inArrayOp(r.id, bidRfqIds) })
      : [];
    const rfqById = new Map(bidRfqs.map((r) => [r.id, r]));

    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
        <h2 className="font-semibold text-ink-900">My Bids</h2>
        {myBids.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">No bids yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {myBids.map((bid) => {
              const rfq = rfqById.get(bid.rfqId);
              if (!rfq) return null;
              return (
                <li key={bid.id}>
                  <Link href={`/marketplace/${rfq.id}`} className="text-sm text-ink-700 hover:text-gold-600">
                    {rfq.product} — ${Number(bid.pricePerUnit)}/{rfq.unit} · {bid.status}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const importerRfqs = await serviceDb.query.rfqs.findMany({
    where: eq(rfqs.organizationId, organization.id),
    orderBy: [desc(rfqs.createdAt)],
    limit: 10,
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
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">My RFQs</h2>
        <Link href="/marketplace/new" className="text-xs font-semibold text-gold-600 hover:text-gold-500">
          Post an RFQ
        </Link>
      </div>
      {importerRfqs.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">You haven&apos;t posted any RFQs yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {importerRfqs.map((rfq) => (
            <li key={rfq.id}>
              <Link href={`/marketplace/${rfq.id}`} className="text-sm text-ink-700 hover:text-gold-600">
                {rfq.product} — {rfq.status} · {importerBidCountByRfqId.get(rfq.id) ?? 0} bids
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
