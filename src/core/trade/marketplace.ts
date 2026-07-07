import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { rfqs, organizations, bids } from "@/db/schema";

export type RfqListItem = {
  id: string;
  product: string;
  hsCode: string;
  originCountry: string;
  destinationCountry: string;
  volume: number;
  unit: string;
  targetPricePerUnit: number;
  currency: string;
  deadline: Date;
  createdAt: Date;
  status: string;
  bidCount: number;
  importer: { name: string; companyName: string | null; kycStatus: string };
};

// Shared by the /marketplace page and /api/rfqs so both list views stay in
// sync. Counts bids in-memory rather than a SQL aggregate join — mirrors the
// Phase 1 Mongoose approach and keeps this simple for the current data
// volumes; revisit with a GROUP BY if the RFQ count grows large.
export async function listOpenRfqs(): Promise<RfqListItem[]> {
  const rows = await serviceDb
    .select({
      id: rfqs.id,
      product: rfqs.product,
      hsCode: rfqs.hsCode,
      originCountry: rfqs.originCountry,
      destinationCountry: rfqs.destinationCountry,
      volume: rfqs.volume,
      unit: rfqs.unit,
      targetPricePerUnit: rfqs.targetPricePerUnit,
      currency: rfqs.currency,
      deadline: rfqs.deadline,
      createdAt: rfqs.createdAt,
      status: rfqs.status,
      importerName: organizations.name,
      importerKycStatus: organizations.kycStatus,
    })
    .from(rfqs)
    .innerJoin(organizations, eq(organizations.id, rfqs.organizationId))
    .where(eq(rfqs.status, "OPEN"))
    .orderBy(sql`${rfqs.createdAt} desc`);

  const rfqIds = rows.map((r) => r.id);
  const bidRows = rfqIds.length
    ? await serviceDb.select({ rfqId: bids.rfqId }).from(bids).where(inArray(bids.rfqId, rfqIds))
    : [];
  const bidCountByRfqId = new Map<string, number>();
  for (const bid of bidRows) {
    bidCountByRfqId.set(bid.rfqId, (bidCountByRfqId.get(bid.rfqId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    product: r.product,
    hsCode: r.hsCode,
    originCountry: r.originCountry,
    destinationCountry: r.destinationCountry,
    volume: Number(r.volume),
    unit: r.unit,
    targetPricePerUnit: Number(r.targetPricePerUnit),
    currency: r.currency,
    deadline: r.deadline,
    createdAt: r.createdAt,
    status: r.status,
    bidCount: bidCountByRfqId.get(r.id) ?? 0,
    importer: { name: r.importerName, companyName: r.importerName, kycStatus: r.importerKycStatus },
  }));
}
