import { describe, it, expect } from "vitest";
import { recommendRoute } from "@/core/ai/route-ai";

describe("recommendRoute", () => {
  it("recommends sea freight for bulk volumes", () => {
    const route = recommendRoute({ volume: 5000, originLocation: "IN", destinationLocation: "AE" });
    expect(route.mode).toBe("SEA");
    expect(route.estimatedCost).toBeGreaterThan(0);
    expect(route.recommendation).toContain("SEA");
  });

  it("recommends air freight for small volumes", () => {
    const route = recommendRoute({ volume: 50, originLocation: "IN", destinationLocation: "AE" });
    expect(route.mode).toBe("AIR");
  });

  it("computes cost as volume-based rate plus a fixed handling fee", () => {
    const route = recommendRoute({ volume: 1000, originLocation: "IN", destinationLocation: "US" });
    // SEA rate is 0.08/unit + $250 base handling fee (see PER_UNIT_RATE/BASE_HANDLING_FEE)
    expect(route.estimatedCost).toBeCloseTo(1000 * 0.08 + 250, 2);
  });
});
