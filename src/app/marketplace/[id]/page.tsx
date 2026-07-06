import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Rfq, Bid, Escrow, Shipment } from "@/models";
import { getSessionUser } from "@/lib/session";
import { serialize } from "@/lib/serialize";
import { CountdownTimer } from "@/components/CountdownTimer";
import { BidPanel } from "./BidPanel";
import { BidList } from "./BidList";
import { EscrowTracker } from "./EscrowTracker";

export const dynamic = "force-dynamic";

type ImporterSummary = { id: string; name: string; companyName: string | null };
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

  const rfqDoc = await Rfq.findById(params.id).populate("importerId", "name companyName");
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
        {rfq.originCountry} → {rfq.destinationCountry} · HS {rfq.hsCode}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50">{rfq.product}</h1>
      <p className="mt-2 text-slate-400">
        {rfq.volume.toLocaleString()} {rfq.unit} · target ${rfq.targetPricePerUnit}/{rfq.unit} ·
        posted by {importer.companyName ?? importer.name}
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

      {rfq.status === "OPEN" && !isOwner && user?.role === "EXPORTER" && (
        <div className="mt-10">
          <BidPanel
            rfqId={rfq.id}
            targetPricePerUnit={rfq.targetPricePerUnit}
            unit={rfq.unit}
            existingBid={myBid}
          />
        </div>
      )}

      {isOwner && (
        <div className="mt-10">
          <BidList rfqId={rfq.id} bids={bids} rfqStatus={rfq.status} totalBidCount={bids.length} />
        </div>
      )}

      {escrow && (
        <div className="mt-10">
          <EscrowTracker
            escrow={escrow}
            canAdvance={isOwner || isParticipantExporter}
            shipment={shipment}
          />
        </div>
      )}

      {!user && (
        <p className="mt-10 text-sm text-slate-500">
          <a href="/login" className="text-emerald-400 hover:underline">
            Sign in
          </a>{" "}
          to bid on this RFQ.
        </p>
      )}
    </main>
  );
}
