import "server-only";
import type { ReactNode } from "react";
import type { StsBreakdown } from "@/core/finance/sts";
import type { CurrentOrganization } from "@/core/identity/session";
import { KycPanel } from "@/components/dashboard/KycPanel";
import { LoanPanel } from "@/components/dashboard/LoanPanel";
import type { WidgetType } from "./registry";
import { StsWidget } from "./StsWidget";
import { RfqsWidget } from "./RfqsWidget";
import { ShipmentsWidget } from "./ShipmentsWidget";
import { RevenueWidget } from "./RevenueWidget";
import { NotificationsWidget } from "./NotificationsWidget";
import { CalendarWidget, TasksWidget } from "./StubWidgets";
import { InvestmentsWidget } from "./InvestmentsWidget";

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
    case "SHIPMENTS":
      return <ShipmentsWidget organization={ctx.organization} />;
    case "REVENUE":
      return ctx.organization.type === "EXPORTER" ? <RevenueWidget organization={ctx.organization} /> : null;
    case "NOTIFICATIONS":
      return <NotificationsWidget profileId={ctx.profileId} />;
    case "CALENDAR":
      return <CalendarWidget />;
    case "TASKS":
      return <TasksWidget />;
    case "INVESTMENTS":
      return ctx.organization.type === "INVESTOR" ? <InvestmentsWidget organization={ctx.organization} /> : null;
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
