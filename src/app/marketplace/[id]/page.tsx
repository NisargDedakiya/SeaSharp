import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Rfq, Bid, Escrow, Shipment } from "@/models";
import { getSessionUser } from "@/lib/session";
import { serialize } from "@/lib/serialize";
import { countryName } from "@/lib/countries";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Reveal } from "@/components/Reveal";
import { BidPanel } from "./BidPanel";
import { BidList } from "./BidList";
import { EscrowTracker } from "./EscrowTracker";

export const dynamic = "force-dynamic";

type ImporterSummary = {
  id: string;
  name: string;
  companyName: string | null;
  country: string | null;
  kycStatus: string;
  createdAt: string;
};
type ExporterSummary = { id: string; name: string; companyName: string | null; stsScore: number };

type SerializedRfq = {
  id: string;
  deadline: Date;
  status: string;
  originCountry: string;
  destinationCountry: string;
  hsCode: string;
  product: string;
  volume: number;
  unit: string;
  targetPricePerUnit: number;
  importerId: ImporterSummary;
};

type SerializedBid = {
  id: string;
  pricePerUnit: number;
  message: string | null;
  aiSuggestedPrice: number | null;
  status: string;
  exporterId: ExporterSummary;
};

type SerializedEscrow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  milestones: Array<{ id: string; name: string; sequence: number; status: string; completedAt: Date | null }>;
};

type SerializedShipment = {
  exporterId: string;
  mode: string;
  aiRouteRecommendation: string | null;
  estimatedCost: number;
};

export default async function RfqDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  await dbConnect();

  if (!mongoose.isValidObjectId(params.id)) notFound();

  const rfqDoc = await Rfq.findById(params.id).populate(
    "importerId",
    "name companyName country kycStatus createdAt"
  );
  if (!rfqDoc) notFound();

  const bidDocs = await Bid.find({ rfqId: rfqDoc._id })
    .populate("exporterId", "name companyName stsScore")
    .sort({ createdAt: 1 });
  const escrowDoc = await Escrow.findOne({ rfqId: rfqDoc._id });
  const shipmentDoc = await Shipment.findOne({ rfqId: rfqDoc._id });

  const { importerId: importer, ...rfq } = serialize(rfqDoc) as SerializedRfq;
  const bids = (serialize(bidDocs) as SerializedBid[]).map(({ exporterId, ...bidRest }) => ({
    ...bidRest,
    exporter: exporterId,
  }));
  const escrow = serialize(escrowDoc) as SerializedEscrow | null;
  const shipment = serialize(shipmentDoc) as SerializedShipment | null;

  const isOwner = user?.id === importer.id;
  const myBid = bids.find((b) => b.exporter.id === user?.id) ?? null;
  const isParticipantExporter = shipment?.exporterId === user?.id;

  const importerVerified = importer.kycStatus === "VERIFIED";
  const memberSince = new Date(importer.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
          {countryName(rfq.originCountry)} → {countryName(rfq.destinationCountry)} · HS {rfq.hsCode}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-50">{rfq.product}</h1>
        <p className="mt-2 text-slate-400">
          {rfq.volume.toLocaleString()} {rfq.unit} · target ${rfq.targetPricePerUnit}/{rfq.unit}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            Status: {rfq.status}
          </span>
          {rfq.status === "OPEN" && (
            <span className="rounded-full bg-slate-800 px-3 py-1">
              <CountdownTimer rfqId={rfq.id} deadline={rfq.deadline.toISOString()} />
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Posted by</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-100">
                {importer.companyName ?? importer.name}
              </span>
              {importerVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  KYC Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {importer.country ? `${countryName(importer.country)} · ` : ""}Member since {memberSince}
            </p>
          </div>
        </div>
      </Reveal>

      {rfq.status === "OPEN" && !isOwner && user?.role === "EXPORTER" && (
        <Reveal className="mt-10">
          <BidPanel
            rfqId={rfq.id}
            targetPricePerUnit={rfq.targetPricePerUnit}
            unit={rfq.unit}
            existingBid={myBid}
          />
        </Reveal>
      )}

      {isOwner && (
        <Reveal className="mt-10">
          <BidList rfqId={rfq.id} bids={bids} rfqStatus={rfq.status} totalBidCount={bids.length} />
        </Reveal>
      )}

      {escrow && (
        <Reveal className="mt-10">
          <EscrowTracker
            escrow={escrow}
            canAdvance={isOwner || isParticipantExporter}
            shipment={shipment}
          />
        </Reveal>
      )}

      {!user && (
        <p className="mt-10 text-sm text-slate-500">
          <a href="/login" className="text-sky-400 hover:underline">
            Sign in
          </a>{" "}
          to bid on this RFQ.
        </p>
      )}
    </main>
  );
}
