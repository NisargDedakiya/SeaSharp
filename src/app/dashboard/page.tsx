import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { shipments, tradeLoans, dashboardLayouts } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { defaultLayoutFor, WIDGET_REGISTRY } from "@/components/dashboard/widgets/registry";
import { renderWidget } from "@/components/dashboard/widgets/render";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";

export const dynamic = "force-dynamic";

// Widget-based dashboard (Task 5/8). Renders whichever widgets the
// signed-in profile has configured for this organization (or the org-type
// default, see registry.ts), instead of the old fixed layout that
// branched on organization.type with hardcoded JSX per branch. Every
// widget's content is still real data — the underlying queries were
// carried over from the old page, just relocated into
// src/components/dashboard/widgets/*.
export default async function DashboardPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login");

  const { organization } = actor;

  // STS + LOAN widgets both need this exporter-only data; computed once
  // here and threaded through renderWidget's context (see render.tsx),
  // same as the old page.tsx did for its exporter branch.
  let stsBreakdown = null;
  let eligibleRfqs: { id: string; product: string; escrowAmount: number }[] = [];
  let loans: {
    id: string;
    requestedAmount: number;
    approvedAmount: number | null;
    interestRatePercent: number | null;
    riskBand: string | null;
    status: string;
  }[] = [];

  if (organization.type === "EXPORTER") {
    stsBreakdown = await recalculateAndSaveSts(organization.id);

    const exporterShipments = await serviceDb.query.shipments.findMany({
      where: eq(shipments.exporterOrganizationId, organization.id),
    });
    const shipmentRfqIds = exporterShipments.map((s) => s.rfqId);
    const awardedRfqs = shipmentRfqIds.length
      ? await serviceDb.query.rfqs.findMany({
          where: (r, { inArray: inArrayOp, and: andOp, or: orOp, eq: eqOp }) =>
            andOp(inArrayOp(r.id, shipmentRfqIds), orOp(eqOp(r.status, "AWARDED"), eqOp(r.status, "FULFILLED"))),
        })
      : [];
    const escrows = awardedRfqs.length
      ? await serviceDb.query.escrowAccounts.findMany({
          where: (e, { inArray: inArrayOp }) =>
            inArrayOp(
              e.rfqId,
              awardedRfqs.map((r) => r.id)
            ),
        })
      : [];
    const escrowByRfqId = new Map(escrows.map((e) => [e.rfqId, e]));

    const exporterLoans = await serviceDb.query.tradeLoans.findMany({
      where: eq(tradeLoans.exporterOrganizationId, organization.id),
      orderBy: (l, { desc }) => [desc(l.requestedAt)],
    });
    const loanedRfqIds = new Set(exporterLoans.filter((l) => l.rfqId).map((l) => l.rfqId!));

    eligibleRfqs = awardedRfqs
      .filter((r) => escrowByRfqId.has(r.id) && !loanedRfqIds.has(r.id))
      .map((r) => ({
        id: r.id,
        product: r.product,
        escrowAmount: Number(escrowByRfqId.get(r.id)!.amount),
      }));

    loans = exporterLoans.map((l) => ({
      id: l.id,
      requestedAmount: Number(l.requestedAmount),
      approvedAmount: l.approvedAmount ? Number(l.approvedAmount) : null,
      interestRatePercent: l.interestRatePercent ? Number(l.interestRatePercent) : null,
      riskBand: l.riskBand,
      status: l.status,
    }));
  }

  const savedLayout = await serviceDb.query.dashboardLayouts.findFirst({
    where: and(eq(dashboardLayouts.profileId, actor.user.id), eq(dashboardLayouts.organizationId, organization.id)),
  });
  const layout = savedLayout?.widgets ?? defaultLayoutFor(organization.type);

  const renderCtx = { organization, profileId: actor.user.id, stsBreakdown, eligibleRfqs, loans };
  const widgets = (
    await Promise.all(
      layout.map(async (item) => {
        const meta = WIDGET_REGISTRY[item.type];
        if (!meta) return null;
        const node = await renderWidget(item.type, renderCtx);
        if (!node) return null;
        return { id: item.id, type: item.type, title: meta.title, gridSpan: meta.gridSpan, node };
      })
    )
  ).filter((w): w is NonNullable<typeof w> => w !== null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-50">
        {organization.type === "EXPORTER" ? "Exporter Dashboard" : "Importer Dashboard"}
      </h1>
      <p className="mt-1 text-slate-400">{organization.name}</p>

      <div className="mt-8">
        <DashboardGrid initialLayout={layout} widgets={widgets} />
      </div>
    </main>
  );
}
