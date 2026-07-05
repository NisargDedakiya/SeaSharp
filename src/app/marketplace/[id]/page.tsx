import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { CountdownTimer } from "@/components/CountdownTimer";
import { BidPanel } from "./BidPanel";
import { BidList } from "./BidList";
import { EscrowTracker } from "./EscrowTracker";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();

  const rfq = await prisma.rfq.findUnique({
    where: { id: params.id },
    include: {
      importer: { select: { id: true, name: true, companyName: true } },
      bids: {
        include: { exporter: { select: { id: true, name: true, companyName: true, tnsScore: true } } },
        orderBy: { createdAt: "asc" },
      },
      escrow: { include: { milestones: { orderBy: { sequence: "asc" } } } },
      shipment: true,
    },
  });

  if (!rfq) notFound();

  const isOwner = user?.id === rfq.importerId;
  const myBid = rfq.bids.find((b) => b.exporterId === user?.id) ?? null;
  const isParticipantExporter = rfq.shipment?.exporterId === user?.id;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
        {rfq.originCountry} → {rfq.destinationCountry} · HS {rfq.hsCode}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50">{rfq.product}</h1>
      <p className="mt-2 text-slate-400">
        {rfq.volume.toLocaleString()} {rfq.unit} · target ${rfq.targetPricePerUnit}/{rfq.unit} ·
        posted by {rfq.importer.companyName ?? rfq.importer.name}
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
          <BidList rfqId={rfq.id} bids={rfq.bids} rfqStatus={rfq.status} totalBidCount={rfq.bids.length} />
        </div>
      )}

      {rfq.escrow && (
        <div className="mt-10">
          <EscrowTracker
            escrow={rfq.escrow}
            canAdvance={isOwner || isParticipantExporter}
            shipment={rfq.shipment}
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
