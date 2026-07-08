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
export const WIDGET_TYPES = [
  "STS",
  "KYC",
  "LOAN",
  "AUDIT_TIMELINE",
  "RFQS",
  "SHIPMENTS",
  "REVENUE",
  "NOTIFICATIONS",
  "CALENDAR",
  "TASKS",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export type WidgetGridSpan = 1 | 2 | 3;

export type WidgetMeta = {
  type: WidgetType;
  title: string;
  gridSpan: WidgetGridSpan;
  /** Which organization types get this widget in their default layout. */
  defaultFor: Array<"EXPORTER" | "IMPORTER">;
};

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  STS: { type: "STS", title: "SeaSharp Trust Score", gridSpan: 3, defaultFor: ["EXPORTER"] },
  KYC: { type: "KYC", title: "KYC / KYB", gridSpan: 1, defaultFor: ["EXPORTER", "IMPORTER"] },
  LOAN: { type: "LOAN", title: "PO-Backed Trade Finance", gridSpan: 2, defaultFor: ["EXPORTER"] },
  AUDIT_TIMELINE: {
    type: "AUDIT_TIMELINE",
    title: "Audit Timeline",
    gridSpan: 2,
    defaultFor: [],
  },
  RFQS: { type: "RFQS", title: "RFQs", gridSpan: 2, defaultFor: ["EXPORTER", "IMPORTER"] },
  SHIPMENTS: { type: "SHIPMENTS", title: "Shipments", gridSpan: 2, defaultFor: ["EXPORTER", "IMPORTER"] },
  REVENUE: { type: "REVENUE", title: "Revenue", gridSpan: 1, defaultFor: ["EXPORTER"] },
  NOTIFICATIONS: { type: "NOTIFICATIONS", title: "Notifications", gridSpan: 1, defaultFor: ["EXPORTER", "IMPORTER"] },
  CALENDAR: { type: "CALENDAR", title: "Calendar", gridSpan: 1, defaultFor: [] },
  TASKS: { type: "TASKS", title: "Tasks", gridSpan: 1, defaultFor: [] },
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
export function defaultLayoutFor(organizationType: string): WidgetLayoutItem[] {
  const orgType = organizationType === "EXPORTER" ? "EXPORTER" : "IMPORTER";
  const types = WIDGET_TYPES.filter((type) => WIDGET_REGISTRY[type].defaultFor.includes(orgType));
  return types.map((type, index) => ({ id: type, type, visible: true, order: index }));
}
