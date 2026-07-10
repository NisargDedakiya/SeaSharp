import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { tradeLoans, dashboardLayouts } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { getEligibleFinancingRfqs } from "@/core/finance/loans";
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

  // STS + LOAN widgets both need this data; computed once here and
  // threaded through renderWidget's context (see render.tsx). STS is
  // exporter-only (a delivery-performance score); LOAN/eligibility apply to
  // both exporters (pre-shipment "buy to export" financing) and importers
  // (import-purchase "buy to resell" financing) — INVESTMENTS (the investor
  // browse/fund widget) fetches its own data directly, same as
  // RfqsWidget/RevenueWidget do for their org types.
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

  if (organization.type === "EXPORTER" || organization.type === "IMPORTER") {
    if (organization.type === "EXPORTER") {
      stsBreakdown = await recalculateAndSaveSts(organization.id);
    }

    eligibleRfqs = await getEligibleFinancingRfqs(organization.id, organization.type);

    const orgLoans = await serviceDb.query.tradeLoans.findMany({
      where: eq(tradeLoans.requestingOrganizationId, organization.id),
      orderBy: (l, { desc }) => [desc(l.requestedAt)],
    });
    loans = orgLoans.map((l) => ({
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
        {organization.type === "EXPORTER"
          ? "Exporter Dashboard"
          : organization.type === "INVESTOR"
            ? "Investor Dashboard"
            : "Importer Dashboard"}
      </h1>
      <p className="mt-1 text-slate-400">{organization.name}</p>

      <div className="mt-8">
        <DashboardGrid initialLayout={layout} widgets={widgets} />
      </div>
    </main>
  );
}
