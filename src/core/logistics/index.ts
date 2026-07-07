import { recommendRoute } from "@/core/ai/route-ai";

// Logistics Engine — the public surface other engines/routes call. Today
// its only real behavior is asking RouteAI for a freight recommendation
// when an RFQ is awarded; the engine owns *that it happens on award* and
// what to do with the result, RouteAI only owns the recommendation itself.
// Carrier booking, container tracking, and milestone-by-milestone shipment
// updates (schema-ready in src/db/schema/logistics.ts) are the next things
// to land in this engine.
export function getRouteRecommendation(params: {
  volume: number;
  originLocation: string;
  destinationLocation: string;
}) {
  return recommendRoute(params);
}
