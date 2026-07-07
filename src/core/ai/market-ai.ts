// MarketAI / BidSense stub: a real model would rank historical winning bids
// by product, season, and volume. Until that training data exists, suggest
// a price just under the buyer's stated target — directionally useful,
// cheap to compute. Called by the Marketplace engine's bid route; never
// decides anything on its own (the bidder can ignore the suggestion).
export function suggestBidPrice(targetPricePerUnit: number): number {
  return Math.round(targetPricePerUnit * 0.97 * 100) / 100;
}
