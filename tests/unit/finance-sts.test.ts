import { describe, it, expect } from "vitest";
import { calculateStsScore, tierForScore, STS_WEIGHTS } from "@/core/finance/sts";

describe("calculateStsScore", () => {
  it("gives a brand-new exporter the neutral half-credit baseline on delivery/escrow/loan, full marks on disputes", () => {
    const result = calculateStsScore({
      kycStatus: "UNVERIFIED",
      totalShipments: 0,
      onTimeShipments: 0,
      escrowReleaseDaysAvg: null,
      disputedShipments: 0,
      totalLoans: 0,
      repaidLoans: 0,
      defaultedLoans: 0,
    });

    expect(result.kycPoints).toBe(0);
    expect(result.onTimeDeliveryPoints).toBe(Math.round(STS_WEIGHTS.onTimeDelivery * 0.5));
    expect(result.escrowSpeedPoints).toBe(Math.round(STS_WEIGHTS.escrowSpeed * 0.5));
    // Zero shipments means a 0% dispute rate, which the formula scores as
    // full marks — it only penalizes disputes that actually happened.
    expect(result.disputePoints).toBe(STS_WEIGHTS.disputeRate);
    expect(result.loanRepaymentPoints).toBe(Math.round(STS_WEIGHTS.loanRepayment * 0.5));
    // 0 + 120 + 100 + 200 + 80 = 500, which lands in the VERIFIED band —
    // an unverified account can't actually reach this in practice since KYC
    // verification is what unlocks bid eligibility in the first place.
    expect(result.totalScore).toBe(500);
    expect(result.tier).toBe("VERIFIED");
  });

  it("awards full marks for a perfect verified exporter with fast escrow release", () => {
    const result = calculateStsScore({
      kycStatus: "VERIFIED",
      totalShipments: 10,
      onTimeShipments: 10,
      escrowReleaseDaysAvg: 3,
      disputedShipments: 0,
      totalLoans: 2,
      repaidLoans: 2,
      defaultedLoans: 0,
    });

    expect(result.totalScore).toBe(1000);
    expect(result.tier).toBe("TRUSTED_PARTNER");
  });

  it("zeroes out loan repayment points after any default, regardless of other repayments", () => {
    const result = calculateStsScore({
      kycStatus: "VERIFIED",
      totalShipments: 5,
      onTimeShipments: 5,
      escrowReleaseDaysAvg: 3,
      disputedShipments: 0,
      totalLoans: 3,
      repaidLoans: 2,
      defaultedLoans: 1,
    });

    expect(result.loanRepaymentPoints).toBe(0);
  });

  it("decays escrow speed points linearly between the 5-day target and 20-day floor", () => {
    const midpoint = calculateStsScore({
      kycStatus: "UNVERIFIED",
      totalShipments: 0,
      onTimeShipments: 0,
      escrowReleaseDaysAvg: 12.5, // halfway between 5 and 20
      disputedShipments: 0,
      totalLoans: 0,
      repaidLoans: 0,
      defaultedLoans: 0,
    });
    expect(midpoint.escrowSpeedPoints).toBe(Math.round(STS_WEIGHTS.escrowSpeed * 0.5));

    const tooSlow = calculateStsScore({
      kycStatus: "UNVERIFIED",
      totalShipments: 0,
      onTimeShipments: 0,
      escrowReleaseDaysAvg: 25,
      disputedShipments: 0,
      totalLoans: 0,
      repaidLoans: 0,
      defaultedLoans: 0,
    });
    expect(tooSlow.escrowSpeedPoints).toBe(0);
  });

  it("penalizes dispute rate steeply — a 25% dispute rate zeroes the dispute score", () => {
    const result = calculateStsScore({
      kycStatus: "UNVERIFIED",
      totalShipments: 4,
      onTimeShipments: 4,
      escrowReleaseDaysAvg: null,
      disputedShipments: 1, // 25% dispute rate
      totalLoans: 0,
      repaidLoans: 0,
      defaultedLoans: 0,
    });
    expect(result.disputePoints).toBe(0);
  });
});

describe("tierForScore", () => {
  it.each([
    [0, "NEW"],
    [400, "NEW"],
    [401, "VERIFIED"],
    [650, "VERIFIED"],
    [651, "RELIABLE"],
    [800, "RELIABLE"],
    [801, "TRUSTED_PARTNER"],
    [1000, "TRUSTED_PARTNER"],
  ] as const)("maps score %i to tier %s", (score, expected) => {
    expect(tierForScore(score)).toBe(expected);
  });
});
