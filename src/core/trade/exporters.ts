import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { organizations, rfqs, bids, shipments } from "@/db/schema";

export type ExporterListItem = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  kycStatus: string;
  stsScore: number;
  createdAt: Date;
  // Track record — every field here is derived from real rows, never fabricated.
  completedShipments: number;
  distinctProducts: number;
  distinctDestinations: number;
  openBids: number;
};

// Mirrors listOpenRfqs' shape and conventions (src/core/trade/marketplace.ts):
// one bulk query for the base rows, then bulk follow-up queries keyed by the
// resulting org ids rather than a per-row query, kept simple for current data
// volumes. Track record signal is aggregated from shipments (delivered
// history) and bids (current pipeline) — both tables the exporter actually
// touches, so nothing here is invented.
export async function listExporters(): Promise<ExporterListItem[]> {
  const orgRows = await serviceDb
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      country: organizations.country,
      kycStatus: organizations.kycStatus,
      stsScore: organizations.stsScore,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(and(eq(organizations.type, "EXPORTER"), sql`${organizations.deletedAt} is null`))
    .orderBy(sql`${organizations.stsScore} desc`);

  const orgIds = orgRows.map((o) => o.id);
  if (orgIds.length === 0) return [];

  const shipmentRows = orgIds.length
    ? await serviceDb
        .select({
          exporterOrganizationId: shipments.exporterOrganizationId,
          rfqId: shipments.rfqId,
          status: shipments.status,
          destinationLocation: shipments.destinationLocation,
        })
        .from(shipments)
        .where(inArray(shipments.exporterOrganizationId, orgIds))
    : [];

  // Need product (HS code) per shipment's RFQ to compute distinct products exported.
  const rfqIds = Array.from(new Set(shipmentRows.map((s) => s.rfqId)));
  const rfqRows = rfqIds.length
    ? await serviceDb
        .select({ id: rfqs.id, hsCode: rfqs.hsCode, destinationCountry: rfqs.destinationCountry })
        .from(rfqs)
        .where(inArray(rfqs.id, rfqIds))
    : [];
  const rfqById = new Map(rfqRows.map((r) => [r.id, r]));

  const bidRows = orgIds.length
    ? await serviceDb
        .select({ organizationId: bids.organizationId, status: bids.status })
        .from(bids)
        .where(and(inArray(bids.organizationId, orgIds), eq(bids.status, "PENDING")))
    : [];

  const shipmentsByOrg = new Map<
    string,
    { completed: number; products: Set<string>; destinations: Set<string> }
  >();
  for (const s of shipmentRows) {
    const entry = shipmentsByOrg.get(s.exporterOrganizationId) ?? {
      completed: 0,
      products: new Set<string>(),
      destinations: new Set<string>(),
    };
    if (s.status === "COMPLETE") entry.completed += 1;
    const rfq = rfqById.get(s.rfqId);
    if (rfq) {
      entry.products.add(rfq.hsCode);
      entry.destinations.add(rfq.destinationCountry);
    }
    shipmentsByOrg.set(s.exporterOrganizationId, entry);
  }

  const openBidsByOrg = new Map<string, number>();
  for (const b of bidRows) {
    openBidsByOrg.set(b.organizationId, (openBidsByOrg.get(b.organizationId) ?? 0) + 1);
  }

  return orgRows.map((o) => {
    const track = shipmentsByOrg.get(o.id);
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      country: o.country,
      kycStatus: o.kycStatus,
      stsScore: o.stsScore,
      createdAt: o.createdAt,
      completedShipments: track?.completed ?? 0,
      distinctProducts: track?.products.size ?? 0,
      distinctDestinations: track?.destinations.size ?? 0,
      openBids: openBidsByOrg.get(o.id) ?? 0,
    };
  });
}
