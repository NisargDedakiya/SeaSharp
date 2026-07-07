import type { freightModeEnum } from "@/db/schema";

type FreightMode = (typeof freightModeEnum.enumValues)[number];

const PER_UNIT_RATE: Record<FreightMode, number> = {
  SEA: 0.08,
  AIR: 0.35,
  ROAD: 0.15,
};

const BASE_HANDLING_FEE: Record<FreightMode, number> = {
  SEA: 250,
  AIR: 150,
  ROAD: 80,
};

// RouteAI stub: a production model would optimize on historical shipment
// data, carrier performance, and live market conditions. Ships static
// heuristics today — sea freight for bulk agri-commodity volumes, air
// freight only recommended for small/urgent loads. The Logistics Engine
// (src/core/logistics/) calls this for a recommendation; it never decides
// anything on its own.
export function recommendRoute(params: {
  volume: number;
  originLocation: string;
  destinationLocation: string;
}) {
  const mode: FreightMode = params.volume > 1000 ? "SEA" : params.volume > 100 ? "SEA" : "AIR";
  const estimatedCost =
    Math.round((params.volume * PER_UNIT_RATE[mode] + BASE_HANDLING_FEE[mode]) * 100) / 100;

  const recommendation = `${mode} freight recommended from ${params.originLocation} to ${params.destinationLocation}: est. ${params.volume} units via ${
    mode === "SEA" ? "port-to-port container consolidation" : mode === "AIR" ? "air cargo" : "cross-border road transport"
  }.`;

  return { mode, estimatedCost, recommendation };
}
