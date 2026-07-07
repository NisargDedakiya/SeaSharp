// Flexport/Freightos adapter — reserved for live freight rates and carrier
// tracking (see docs/06-api-integration-spec.md's integrations table). The
// Logistics Engine's RouteAI (src/core/ai/route-ai.ts) currently returns a
// static heuristic estimate instead. Swap that call for a real quote from
// here once a freight API contract is signed — RouteAI's callers don't need
// to change, only what backs the recommendation.
export {};
