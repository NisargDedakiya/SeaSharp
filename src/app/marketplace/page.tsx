import Link from "next/link";
import { listOpenRfqs } from "@/core/trade/marketplace";
import { getSessionActor } from "@/core/identity/session";
import { Reveal } from "@/components/Reveal";
import { TrustStrip } from "@/components/TrustStrip";
import { MarketplaceBrowser } from "./MarketplaceBrowser";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const actor = await getSessionActor();
  const openRfqs = await listOpenRfqs();
  const rfqs = openRfqs.map((r) => ({
    ...r,
    deadline: r.deadline.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
  const verifiedCount = rfqs.filter((r) => r.importer.kycStatus === "VERIFIED").length;
  const totalBids = rfqs.reduce((sum, r) => sum + r.bidCount, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
              Pillar B · Reverse-Auction RFQ
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink-900">RFQ Marketplace</h1>
            <p className="mt-1 text-sm text-ink-500">
              {rfqs.length} open RFQ{rfqs.length === 1 ? "" : "s"} · {totalBids} bid{totalBids === 1 ? "" : "s"}{" "}
              placed · {verifiedCount} from KYC-verified importers
            </p>
          </div>
          {actor?.organization.type === "IMPORTER" && (
            <Link
              href="/marketplace/new"
              className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-cream-50 shadow-premium transition-transform duration-200 hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98]"
            >
              Post an RFQ
            </Link>
          )}
        </div>
        <TrustStrip className="mt-6 justify-start" />
      </Reveal>

      <div className="mt-10">
        {rfqs.length === 0 ? (
          <p className="text-ink-500">No open RFQs yet. Be the first to post one.</p>
        ) : (
          <MarketplaceBrowser rfqs={rfqs} />
        )}
      </div>
    </main>
  );
}
