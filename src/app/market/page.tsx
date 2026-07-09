import Link from "next/link";
import { listExporters } from "@/core/trade/exporters";
import { listOpenRfqs } from "@/core/trade/marketplace";
import { getSessionActor } from "@/core/identity/session";
import { Reveal } from "@/components/Reveal";
import { TrustStrip } from "@/components/TrustStrip";
import { ExporterDirectory } from "./ExporterDirectory";
import { MarketplaceBrowser } from "../marketplace/MarketplaceBrowser";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const actor = await getSessionActor();
  const isExporter = actor?.organization.type === "EXPORTER";

  // Importers, unauthenticated visitors, and every other org type get the
  // exporter directory — mirrors /marketplace's decision to let signed-out
  // visitors see open RFQs; discovery here is public in the same spirit.
  // Only a signed-in EXPORTER gets the open-import-requests view, since
  // that's the one flow that's actually theirs to act on (bidding).
  if (isExporter) {
    const openRfqs = await listOpenRfqs();
    const rfqs = openRfqs.map((r) => ({
      ...r,
      deadline: r.deadline.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));

    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">Market · Import Requests</p>
          <h1 className="mt-2 text-3xl font-bold text-ink-900">Open Import Requests</h1>
          <p className="mt-1 text-sm text-ink-500">
            {rfqs.length} open request{rfqs.length === 1 ? "" : "s"} from importers looking for exporters like you.
            Apply by submitting a bid.
          </p>
          <TrustStrip className="mt-6 justify-start" />
        </Reveal>

        <div className="mt-10">
          {rfqs.length === 0 ? (
            <p className="text-ink-500">No open import requests right now. Check back soon.</p>
          ) : (
            <MarketplaceBrowser rfqs={rfqs} />
          )}
        </div>
      </main>
    );
  }

  const exporterRows = await listExporters();
  const exporters = exporterRows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
  const verifiedCount = exporters.filter((e) => e.kycStatus === "VERIFIED").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">Market · Exporter Directory</p>
            <h1 className="mt-2 text-3xl font-bold text-ink-900">Find the Best Exporters</h1>
            <p className="mt-1 text-sm text-ink-500">
              {exporters.length} exporter{exporters.length === 1 ? "" : "s"} on SeaSharp · {verifiedCount} KYC-verified
              · ranked by real STS score and delivery track record.
            </p>
          </div>
          <Link
            href="/marketplace/new"
            className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-cream-50 shadow-premium transition-transform duration-200 hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98]"
          >
            Submit an Import Request
          </Link>
        </div>
        <TrustStrip className="mt-6 justify-start" />
      </Reveal>

      <div className="mt-10">
        {exporters.length === 0 ? (
          <p className="text-ink-500">No exporters have joined SeaSharp yet.</p>
        ) : (
          <ExporterDirectory exporters={exporters} />
        )}
      </div>

      {!actor && (
        <p className="mt-10 text-sm text-ink-500">
          <Link href="/login" className="text-gold-600 hover:underline">
            Sign in
          </Link>{" "}
          as an importer to post an import request, or{" "}
          <Link href="/register" className="text-gold-600 hover:underline">
            create an account
          </Link>{" "}
          to get started.
        </p>
      )}
    </main>
  );
}
