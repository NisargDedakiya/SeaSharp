import { describe, it, expect } from "vitest";
import { calculateLandedCost } from "@/lib/compliance";

describe("calculateLandedCost", () => {
  it("computes tariff, additional fees, and total landed cost", () => {
    const result = calculateLandedCost({
      productValue: 10_000,
      tariffPercent: 5,
      additionalFeePercent: 2,
      estimatedFreight: 500,
    });

    expect(result.tariffAmount).toBe(500);
    expect(result.additionalFeeAmount).toBe(200);
    expect(result.landedCost).toBe(10_000 + 500 + 200 + 500);
  });

  it("handles a zero-tariff, zero-fee trade lane", () => {
    const result = calculateLandedCost({
      productValue: 5_000,
      tariffPercent: 0,
      additionalFeePercent: 0,
      estimatedFreight: 250,
    });

    expect(result.tariffAmount).toBe(0);
    expect(result.additionalFeeAmount).toBe(0);
    expect(result.landedCost).toBe(5_250);
  });

  it("rounds to the nearest cent", () => {
    const result = calculateLandedCost({
      productValue: 999.99,
      tariffPercent: 3.3333,
      additionalFeePercent: 1.1111,
      estimatedFreight: 10,
    });

    expect(Number.isInteger(result.tariffAmount * 100)).toBe(true);
    expect(Number.isInteger(result.additionalFeeAmount * 100)).toBe(true);
    expect(Number.isInteger(result.landedCost * 100)).toBe(true);
  });
});
