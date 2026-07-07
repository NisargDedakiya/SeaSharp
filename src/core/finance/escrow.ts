// The fixed milestone sequence every awarded RFQ's escrow account is seeded
// with — see src/app/api/rfqs/[id]/award/route.ts (creation) and
// src/app/api/escrow/[id]/release/route.ts (progression).
export const ESCROW_MILESTONES = [
  "Order Confirmed & Escrow Funded",
  "Goods Picked Up from Exporter Warehouse",
  "Customs Cleared",
  "Delivered to Importer",
  "Escrow Released",
] as const;
