import "server-only";
import { eq, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { organizations, shipments, escrowAccounts, tradeLoans, stsScoreLogs } from "@/db/schema";
import { calculateStsScore, type StsBreakdown } from "@/core/finance/sts";

// Recomputes an organization's STS from its live platform history, persists
// it on the organization row, and appends an audit log entry
// (sts_score_logs). Runs inside one transaction so the score and its audit
// trail never diverge — mirrors the Phase 1 Mongoose replica-set transaction.
//
// Shipment-based inputs (on-time delivery, escrow speed) are read off
// whichever side of `shipments` this org sat on — `exporterOrganizationId`
// for an EXPORTER, `importerOrganizationId` for an IMPORTER — so the same
// STS-gated financing tier system (src/core/ai/credit-ai.ts) can score both
// export-purchase and import-purchase requests, not just exporters.
export async function recalculateAndSaveSts(organizationId: string): Promise<StsBreakdown> {
  const org = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!org) throw new Error(`Organization ${organizationId} not found`);

  const shipmentSideColumn = org.type === "IMPORTER" ? shipments.importerOrganizationId : shipments.exporterOrganizationId;
  const orgShipments = await serviceDb
    .select()
    .from(shipments)
    .where(eq(shipmentSideColumn, organizationId));
  const totalShipments = orgShipments.length;
  const onTimeShipments = orgShipments.filter(
    (s) => s.deliveredAt && s.customsClearedAt && s.status !== "DISPUTED"
  ).length;
  const disputedShipments = orgShipments.filter((s) => s.status === "DISPUTED").length;

  const rfqIds = orgShipments.map((s) => s.rfqId);
  const escrows = rfqIds.length
    ? await serviceDb.select().from(escrowAccounts).where(inArray(escrowAccounts.rfqId, rfqIds))
    : [];
  const releaseDurations = escrows
    .filter((e) => e.fundedAt && e.releasedAt)
    .map((e) => (e.releasedAt!.getTime() - e.fundedAt!.getTime()) / (1000 * 60 * 60 * 24));
  const escrowReleaseDaysAvg =
    releaseDurations.length > 0
      ? releaseDurations.reduce((a, b) => a + b, 0) / releaseDurations.length
      : null;

  const loans = await serviceDb
    .select()
    .from(tradeLoans)
    .where(eq(tradeLoans.requestingOrganizationId, organizationId));
  const totalLoans = loans.length;
  const repaidLoans = loans.filter((l) => l.status === "REPAID").length;
  const defaultedLoans = loans.filter((l) => l.status === "DEFAULTED").length;

  const breakdown = calculateStsScore({
    kycStatus: org.kycStatus,
    totalShipments,
    onTimeShipments,
    escrowReleaseDaysAvg,
    disputedShipments,
    totalLoans,
    repaidLoans,
    defaultedLoans,
  });

  await serviceDb.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({ stsScore: breakdown.totalScore })
      .where(eq(organizations.id, organizationId));

    await tx.insert(stsScoreLogs).values({
      organizationId,
      totalScore: breakdown.totalScore,
      kycPoints: breakdown.kycPoints,
      onTimeDeliveryPoints: breakdown.onTimeDeliveryPoints,
      escrowSpeedPoints: breakdown.escrowSpeedPoints,
      disputePoints: breakdown.disputePoints,
      loanRepaymentPoints: breakdown.loanRepaymentPoints,
    });
  });

  return breakdown;
}
