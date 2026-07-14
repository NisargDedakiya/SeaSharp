// Widget registry for the dashboard (Task 5/8). A `Widget` is a small,
// user-configurable unit rendered on /dashboard: existing panels
// (KycPanel, LoanPanel, Task 2's AuditTimelineWidget) plus new ones added
// here (RFQs, Shipments, Revenue, Notifications, Calendar, Tasks), all
// registered by `type` so dashboard/page.tsx can render a configured,
// ordered list generically instead of hardcoded JSX per org type.
//
// Rendering itself lives in ./render.tsx (a server-only module, since most
// widgets query the DB directly) — this file only holds the type + the
// per-type metadata (title, grid span, which org types see it by default)
// so it can be imported from both server and client code without pulling
// in `server-only` dependencies.
import { organizationTypeEnum } from "@/db/schema/identity";

export const WIDGET_TYPES = [
  "STS",
  "KYC",
  "LOAN",
  "AUDIT_TIMELINE",
  "RFQS",
  "DEALS",
  "SHIPMENTS",
  "REVENUE",
  "NOTIFICATIONS",
  "CALENDAR",
  "TASKS",
  "CUSTOMS_QUEUE",
  "INVENTORY",
  "POLICIES",
  "FUNDING_OPPORTUNITIES",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export type WidgetGridSpan = 1 | 2 | 3;

// Derived from the schema enum (src/db/schema/identity.ts's
// organizationTypeEnum) rather than hand-duplicated, so adding a new
// business type to the schema surfaces here as a type error until this
// registry (and defaultLayoutFor below) is updated for it.
export type OrganizationType = (typeof organizationTypeEnum.enumValues)[number];

export type WidgetMeta = {
  type: WidgetType;
  title: string;
  gridSpan: WidgetGridSpan;
  /** Which organization types get this widget in their default layout. */
  defaultFor: OrganizationType[];
};

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  STS: { type: "STS", title: "SeaSharp Trust Score", gridSpan: 3, defaultFor: ["EXPORTER"] },
  KYC: {
    type: "KYC",
    title: "KYC / KYB",
    gridSpan: 1,
    defaultFor: [
      "EXPORTER",
      "IMPORTER",
      "FREIGHT_FORWARDER",
      "CUSTOMS_BROKER",
      "WAREHOUSE_PROVIDER",
      "INSURANCE_PROVIDER",
      "FINANCE_PARTNER",
      "INVESTOR",
    ],
  },
  LOAN: { type: "LOAN", title: "PO-Backed Trade Finance", gridSpan: 2, defaultFor: ["EXPORTER"] },
  AUDIT_TIMELINE: {
    type: "AUDIT_TIMELINE",
    title: "Audit Timeline",
    gridSpan: 2,
    defaultFor: [],
  },
  RFQS: { type: "RFQS", title: "RFQs", gridSpan: 2, defaultFor: ["EXPORTER", "IMPORTER"] },
  // Importer-confirmed deals (deals table, src/db/schema/marketplace.ts).
  // Exporters get the actionable view: request loan / funds-advance
  // financing from investors against a confirmed deal (funding_requests).
  DEALS: { type: "DEALS", title: "Confirmed Deals", gridSpan: 2, defaultFor: ["EXPORTER", "IMPORTER"] },
  // Real query is scoped to the two shipment parties (exporterOrganizationId
  // / importerOrganizationId — see ShipmentsWidget.tsx and
  // src/db/schema/logistics.ts's `shipments` table). There is no
  // forwarder-assignment column on `shipments`, so a freight forwarder
  // cannot be honestly resolved to "their" shipments yet. FREIGHT_FORWARDER
  // is still listed here (it does default to this widget slot) but
  // render.tsx's SHIPMENTS case renders a "coming soon" stub for that org
  // type instead of the real exporter/importer query.
  SHIPMENTS: { type: "SHIPMENTS", title: "Shipments", gridSpan: 2, defaultFor: ["EXPORTER", "IMPORTER", "FREIGHT_FORWARDER"] },
  REVENUE: { type: "REVENUE", title: "Revenue", gridSpan: 1, defaultFor: ["EXPORTER"] },
  NOTIFICATIONS: {
    type: "NOTIFICATIONS",
    title: "Notifications",
    gridSpan: 1,
    defaultFor: [
      "EXPORTER",
      "IMPORTER",
      "FREIGHT_FORWARDER",
      "CUSTOMS_BROKER",
      "WAREHOUSE_PROVIDER",
      "INSURANCE_PROVIDER",
      "FINANCE_PARTNER",
      "INVESTOR",
    ],
  },
  CALENDAR: { type: "CALENDAR", title: "Calendar", gridSpan: 1, defaultFor: [] },
  TASKS: { type: "TASKS", title: "Tasks", gridSpan: 1, defaultFor: [] },
  // Stub widgets below: no owning domain table/column exists yet to back
  // these honestly (see logistics.ts / finance.ts — no forwarder
  // assignment, no customs-queue table, no warehouse/inventory table, no
  // insurance-policy table). "Coming soon" placeholders only, no
  // fabricated data.
  CUSTOMS_QUEUE: { type: "CUSTOMS_QUEUE", title: "Customs Queue", gridSpan: 2, defaultFor: ["CUSTOMS_BROKER"] },
  INVENTORY: { type: "INVENTORY", title: "Inventory", gridSpan: 2, defaultFor: ["WAREHOUSE_PROVIDER"] },
  POLICIES: { type: "POLICIES", title: "Policies", gridSpan: 2, defaultFor: ["INSURANCE_PROVIDER"] },
  // Real widget (no longer a stub): the open book of funding_requests
  // (src/db/schema/finance.ts) that exporters raised against confirmed
  // deals, browsable + fundable by INVESTOR / FINANCE_PARTNER orgs.
  FUNDING_OPPORTUNITIES: {
    type: "FUNDING_OPPORTUNITIES",
    title: "Funding Opportunities",
    gridSpan: 2,
    defaultFor: ["FINANCE_PARTNER", "INVESTOR"],
  },
};

export type WidgetLayoutItem = {
  id: string;
  type: WidgetType;
  visible: boolean;
  order: number;
};

// Default layout for a profile/org that has never saved a custom one —
// mirrors notificationPreferences's "no row = opted in by default"
// fallback (src/core/notifications/service.ts) rather than requiring a
// migration/backfill to seed every existing profile.
//
// AUDIT_TIMELINE isn't included by default: it needs a specific
// entityType/entityId (an RFQ or shipment), so it isn't a generic
// dashboard-level widget the way the others are. It stays registered so a
// future "view this RFQ's audit trail" surface can add it to a layout, and
// so this dashboard's per-RFQ links can enable it, but it's opt-in.
//
// Switches explicitly on all 8 organization types modeled by
// organizationTypeEnum (src/db/schema/identity.ts) — no silent fallback
// bucket that collapses an unhandled type into another one's layout.
export function defaultLayoutFor(organizationType: OrganizationType): WidgetLayoutItem[] {
  let types: WidgetType[];
  switch (organizationType) {
    case "EXPORTER":
      types = ["STS", "KYC", "DEALS", "LOAN", "RFQS", "SHIPMENTS", "REVENUE", "NOTIFICATIONS"];
      break;
    case "IMPORTER":
      types = ["KYC", "RFQS", "DEALS", "SHIPMENTS", "NOTIFICATIONS"];
      break;
    case "FREIGHT_FORWARDER":
      types = ["KYC", "NOTIFICATIONS", "SHIPMENTS"];
      break;
    case "CUSTOMS_BROKER":
      types = ["KYC", "NOTIFICATIONS", "CUSTOMS_QUEUE"];
      break;
    case "WAREHOUSE_PROVIDER":
      types = ["KYC", "NOTIFICATIONS", "INVENTORY"];
      break;
    case "INSURANCE_PROVIDER":
      types = ["KYC", "NOTIFICATIONS", "POLICIES"];
      break;
    case "FINANCE_PARTNER":
    case "INVESTOR":
      types = ["KYC", "NOTIFICATIONS", "FUNDING_OPPORTUNITIES"];
      break;
  }
  return types.map((type, index) => ({ id: type, type, visible: true, order: index }));
}
