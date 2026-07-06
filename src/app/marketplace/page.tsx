import Link from "next/link";
import { dbConnect } from "@/lib/mongoose";
import { listOpenRfqs } from "@/lib/rfqs";
import { getSessionUser } from "@/lib/session";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type RfqListItem = {
  id: string;
  product: string;
  volume: number;
  unit: string;
  originCountry: string;
  destinationCountry: string;
  targetPricePerUnit: number;
  deadline: string;
  bidCount: number;
  importer: { name: string; companyName: string | null };
};

export default async function MarketplacePage() {
  const user = await getSessionUser();
  await dbConnect();
  const rfqs = serialize(await listOpenRfqs()) as RfqListItem[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Pillar B · Reverse-Auction RFQ
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-50">RFQ Marketplace</h1>
        </div>
        {user?.role === "IMPORTER" && (
          <Link
            href="/marketplace/new"
            className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Post an RFQ
          </Link>
        )}
      </div>

      <div className="mt-10 space-y-4">
        {rfqs.length === 0 && (
          <p className="text-slate-500">No open RFQs yet. Be the first to post one.</p>
        )}
        {rfqs.map((rfq) => (
          <Link
            key={rfq.id}
            href={`/marketplace/${rfq.id}`}
            className="block rounded-xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-600"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">{rfq.product}</h2>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                {rfq.bidCount} bid{rfq.bidCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {rfq.volume.toLocaleString()} {rfq.unit} · {rfq.originCountry} → {rfq.destinationCountry} ·
              target ${rfq.targetPricePerUnit}/{rfq.unit}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Posted by {rfq.importer.companyName ?? rfq.importer.name} · Bidding closes{" "}
              {new Date(rfq.deadline).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
