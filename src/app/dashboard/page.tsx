import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { shipments, tradeLoans, dashboardLayouts } from "@/db/schema";
import { getSessionActor } from "@/core/identity/session";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { defaultLayoutFor, WIDGET_REGISTRY, type OrganizationType } from "@/components/dashboard/widgets/registry";
import { renderWidget } from "@/components/dashboard/widgets/render";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { TeamIntegrationsPanel } from "@/components/dashboard/TeamIntegrationsPanel";

export const dynamic = "force-dynamic";

// Human-readable label per business type (all 8 values of
// organizationTypeEnum, src/db/schema/identity.ts) for the dashboard
// header — previously this collapsed every non-EXPORTER type into
// "Importer Dashboard".
const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  EXPORTER: "Exporter Dashboard",
  IMPORTER: "Importer Dashboard",
  FREIGHT_FORWARDER: "Freight Forwarder Dashboard",
  CUSTOMS_BROKER: "Customs Broker Dashboard",
  WAREHOUSE_PROVIDER: "Warehouse Provider Dashboard",
  INSURANCE_PROVIDER: "Insurance Provider Dashboard",
  FINANCE_PARTNER: "Finance Partner Dashboard",
  INVESTOR: "Investor Dashboard",
};

// Exact seeded RBAC role names from drizzle/manual/02_seed_system_roles.sql
// ('Owner', 'Admin', 'Member') — the "Team & Integrations" section is
// gated on this, not on organization.type, since it's a per-org-membership
// permission, not a business-type concern.
const TEAM_INTEGRATIONS_ROLES = new Set(["Owner", "Admin"]);

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
  const layout = savedLayout?.widgets ?? defaultLayoutFor(organization.type as OrganizationType);

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

  const showTeamIntegrations = TEAM_INTEGRATIONS_ROLES.has(organization.roleName);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink-900">
        {ORG_TYPE_LABELS[organization.type as OrganizationType] ?? "Dashboard"}
      </h1>
      <p className="mt-1 flex items-center gap-2 text-ink-500">
        {organization.name}
        <span className="rounded-full border border-ink-100 bg-cream-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
          {organization.roleName}
        </span>
      </p>

      <div className="mt-8">
        <DashboardGrid initialLayout={layout} widgets={widgets} />
      </div>

      {showTeamIntegrations && (
        <div className="mt-6">
          <TeamIntegrationsPanel />
        </div>
      )}
    </main>
  );
}
