import "server-only";
import type { ReactNode } from "react";
import type { StsBreakdown } from "@/core/finance/sts";
import type { CurrentOrganization } from "@/core/identity/session";
import { KycPanel } from "@/components/dashboard/KycPanel";
import { LoanPanel } from "@/components/dashboard/LoanPanel";
import type { WidgetType } from "./registry";
import { StsWidget } from "./StsWidget";
import { RfqsWidget } from "./RfqsWidget";
import { DealsWidget } from "./DealsWidget";
import { ShipmentsWidget } from "./ShipmentsWidget";
import { RevenueWidget } from "./RevenueWidget";
import { NotificationsWidget } from "./NotificationsWidget";
import { FundingOpportunitiesWidget } from "./FundingOpportunitiesWidget";
import {
  CalendarWidget,
  TasksWidget,
  ShipmentsStubWidget,
  CustomsQueueWidget,
  InventoryWidget,
  PoliciesWidget,
} from "./StubWidgets";

export type WidgetRenderContext = {
  organization: CurrentOrganization;
  profileId: string;
  // Exporter-only data, computed once in dashboard/page.tsx and shared by
  // the STS and LOAN widgets so they don't each recompute it.
  stsBreakdown: StsBreakdown | null;
  eligibleRfqs: { id: string; product: string; escrowAmount: number }[];
  loans: {
    id: string;
    requestedAmount: number;
    approvedAmount: number | null;
    interestRatePercent: number | null;
    riskBand: string | null;
    status: string;
  }[];
};

// The registry maps a widget type to a render function generically, so
// dashboard/page.tsx never branches on widget type itself. Widgets that
// need org/profile-scoped data fetch it themselves (server components);
// STS/KYC/LOAN reuse data the page already computed since the old
// dashboard needed the same STS recompute for both.
export async function renderWidget(type: WidgetType, ctx: WidgetRenderContext): Promise<ReactNode | null> {
  switch (type) {
    case "STS":
      return ctx.stsBreakdown ? <StsWidget breakdown={ctx.stsBreakdown} /> : null;
    case "KYC":
      return <KycPanel kycStatus={ctx.organization.kycStatus} />;
    case "LOAN":
      return <LoanPanel eligibleRfqs={ctx.eligibleRfqs} loans={ctx.loans} />;
    case "RFQS":
      return <RfqsWidget organization={ctx.organization} />;
    case "DEALS":
      // Both trade parties see their confirmed deals; only the exporter
      // side gets the request-funding action (enforced again server-side
      // in /api/funding-requests).
      if (ctx.organization.type === "EXPORTER" || ctx.organization.type === "IMPORTER") {
        return <DealsWidget organization={ctx.organization} />;
      }
      return null;
    case "SHIPMENTS":
      // Real query is exporter/importer-party-scoped only (see
      // registry.ts's SHIPMENTS comment) — freight forwarders get an
      // honest stub instead of a fabricated forwarder view.
      if (ctx.organization.type === "EXPORTER" || ctx.organization.type === "IMPORTER") {
        return <ShipmentsWidget organization={ctx.organization} />;
      }
      return <ShipmentsStubWidget />;
    case "REVENUE":
      return ctx.organization.type === "EXPORTER" ? <RevenueWidget organization={ctx.organization} /> : null;
    case "NOTIFICATIONS":
      return <NotificationsWidget profileId={ctx.profileId} />;
    case "CALENDAR":
      return <CalendarWidget />;
    case "TASKS":
      return <TasksWidget />;
    case "CUSTOMS_QUEUE":
      return <CustomsQueueWidget />;
    case "INVENTORY":
      return <InventoryWidget />;
    case "POLICIES":
      return <PoliciesWidget />;
    case "FUNDING_OPPORTUNITIES":
      // Real open-requests book, capital-provider roles only — mirrors the
      // fund action's own INVESTOR/FINANCE_PARTNER gate in
      // src/core/finance/funding.ts.
      if (ctx.organization.type === "INVESTOR" || ctx.organization.type === "FINANCE_PARTNER") {
        return <FundingOpportunitiesWidget />;
      }
      return null;
    case "AUDIT_TIMELINE":
      // Needs a specific entityType/entityId that a generic dashboard
      // layout doesn't have — see registry.ts's comment. Not rendered
      // from the dashboard grid; kept registered for RFQ/shipment detail
      // pages that already know which entity to show.
      return null;
    default:
      return null;
  }
}
