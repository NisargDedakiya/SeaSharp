import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { rfqs, organizations, bids, escrowAccounts, escrowMilestones, shipments, deals } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { countryName } from "@/lib/countries";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Reveal } from "@/components/Reveal";
import { BidPanel } from "./BidPanel";
import { BidList } from "./BidList";
import { EscrowTracker } from "./EscrowTracker";
import { ConfirmDealPanel } from "./ConfirmDealPanel";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getSessionActor();

  const rfq = await serviceDb.query.rfqs.findFirst({ where: eq(rfqs.id, id) });
  if (!rfq) notFound();

  const importer = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, rfq.organizationId),
  });
  if (!importer) notFound();

  const bidRows = await serviceDb.query.bids.findMany({
    where: eq(bids.rfqId, rfq.id),
    orderBy: [asc(bids.createdAt)],
  });
  const bidOrgIds = Array.from(new Set(bidRows.map((b) => b.organizationId)));
  const bidOrgs = bidOrgIds.length
    ? await serviceDb.query.organizations.findMany({ where: (o, { inArray }) => inArray(o.id, bidOrgIds) })
    : [];
  const orgById = new Map(bidOrgs.map((o) => [o.id, o]));

  const bidList = bidRows.map((b) => {
    const org = orgById.get(b.organizationId);
    return {
      id: b.id,
      pricePerUnit: Number(b.pricePerUnit),
      message: b.message,
      aiSuggestedPrice: b.aiSuggestedPrice ? Number(b.aiSuggestedPrice) : null,
      status: b.status,
      exporter: {
        id: b.organizationId,
        name: org?.name ?? "",
        companyName: org?.name ?? null,
        stsScore: org?.stsScore ?? 0,
      },
    };
  });

  const escrow = await serviceDb.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.rfqId, rfq.id) });
  const milestoneRows = escrow
    ? await serviceDb.query.escrowMilestones.findMany({
        where: eq(escrowMilestones.escrowAccountId, escrow.id),
        orderBy: (m, { asc: ascOp }) => [ascOp(m.sequence)],
      })
    : [];
  const shipment = await serviceDb.query.shipments.findFirst({ where: eq(shipments.rfqId, rfq.id) });
  const deal = await serviceDb.query.deals.findFirst({ where: eq(deals.rfqId, rfq.id) });

  const isOwner = actor?.organization.id === rfq.organizationId;
  const myBid = bidList.find((b) => b.exporter.id === actor?.organization.id) ?? null;
  const isParticipantExporter = shipment?.exporterOrganizationId === actor?.organization.id;

  const importerVerified = importer.kycStatus === "VERIFIED";
  const memberSince = new Date(importer.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const volume = Number(rfq.volume);
  const targetPricePerUnit = Number(rfq.targetPricePerUnit);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
          {countryName(rfq.originCountry)} → {countryName(rfq.destinationCountry)} · HS {rfq.hsCode}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">{rfq.product}</h1>
        <p className="mt-2 text-ink-500">
          {volume.toLocaleString()} {rfq.unit} · target ${targetPricePerUnit}/{rfq.unit}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-full border px-3 py-1 font-medium ${
              rfq.status === "OPEN"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : rfq.status === "AWARDED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            Status: {rfq.status}
          </span>
          {rfq.status === "OPEN" && (
            <span className="rounded-full border border-ink-100 bg-white px-3 py-1 text-ink-700">
              <CountdownTimer rfqId={rfq.id} deadline={rfq.deadline.toISOString()} />
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-premium">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Posted by</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-900">{importer.name}</span>
              {importerVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-0.5 text-xs font-medium text-gold-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  KYC Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {importer.country ? `${countryName(importer.country)} · ` : ""}Member since {memberSince}
            </p>
          </div>
        </div>
      </Reveal>

      {rfq.status === "OPEN" && !isOwner && actor?.organization.type === "EXPORTER" && (
        <Reveal className="mt-10">
          <BidPanel
            rfqId={rfq.id}
            targetPricePerUnit={targetPricePerUnit}
            unit={rfq.unit}
            existingBid={myBid}
          />
        </Reveal>
      )}

      {isOwner && (
        <Reveal className="mt-10">
          <BidList rfqId={rfq.id} bids={bidList} rfqStatus={rfq.status} totalBidCount={bidList.length} />
        </Reveal>
      )}

      {(() => {
        // Deal confirmation: importer-only, once a bid is awarded. Value
        // mirrors what confirmDeal (src/core/trade/deals.ts) will record —
        // the escrowed amount, falling back to price x volume.
        if (!isOwner || (rfq.status !== "AWARDED" && rfq.status !== "FULFILLED") || !rfq.awardedBidId) {
          return null;
        }
        const winningBid = bidList.find((b) => b.id === rfq.awardedBidId);
        if (!winningBid) return null;
        const dealValue = escrow ? Number(escrow.amount) : Math.round(winningBid.pricePerUnit * volume * 100) / 100;
        return (
          <Reveal className="mt-10">
            <ConfirmDealPanel
              rfqId={rfq.id}
              exporterName={winningBid.exporter.name}
              dealValue={dealValue}
              currency={rfq.currency}
              deal={
                deal
                  ? {
                      totalValue: Number(deal.totalValue),
                      currency: deal.currency,
                      status: deal.status,
                      exporterName: winningBid.exporter.name,
                      confirmedAt: deal.confirmedAt,
                    }
                  : null
              }
            />
          </Reveal>
        );
      })()}

      {escrow && (
        <Reveal className="mt-10">
          <EscrowTracker
            escrow={{
              id: escrow.id,
              amount: Number(escrow.amount),
              currency: escrow.currency,
              status: escrow.status,
              milestones: milestoneRows.map((m) => ({
                id: m.id,
                name: m.name,
                sequence: m.sequence,
                status: m.status,
                completedAt: m.completedAt,
              })),
            }}
            canAdvance={isOwner || isParticipantExporter}
            shipment={
              shipment
                ? {
                    mode: shipment.mode,
                    aiRouteRecommendation: shipment.aiRouteRecommendation,
                    estimatedCost: Number(shipment.estimatedCost),
                  }
                : null
            }
          />
        </Reveal>
      )}

      {!actor && (
        <p className="mt-10 text-sm text-ink-500">
          <a href="/login" className="text-gold-600 hover:underline">
            Sign in
          </a>{" "}
          to bid on this RFQ.
        </p>
      )}
    </main>
  );
}
