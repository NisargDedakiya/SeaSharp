import { describe, it, expect } from "vitest";
import { scoreLoanRequest } from "@/core/ai/credit-ai";

describe("scoreLoanRequest", () => {
  it("rejects financing for a NEW-tier exporter (no track record yet)", () => {
    const decision = scoreLoanRequest({ stsScore: 300, requestedAmount: 10_000, poValue: 20_000 });
    expect(decision.approved).toBe(false);
    expect(decision.approvedAmount).toBeNull();
    expect(decision.riskBand).toBe("NEW");
  });

  it("approves a TRUSTED_PARTNER at the lowest rate and highest advance", () => {
    const decision = scoreLoanRequest({ stsScore: 900, requestedAmount: 100_000, poValue: 100_000 });
    expect(decision.approved).toBe(true);
    expect(decision.interestRatePercent).toBe(8);
    expect(decision.approvedAmount).toBe(90_000); // 90% advance rate
  });

  it("caps the approved amount at the tier's advance rate even if more was requested", () => {
    const decision = scoreLoanRequest({ stsScore: 700, requestedAmount: 1_000_000, poValue: 10_000 });
    expect(decision.approved).toBe(true);
    expect(decision.approvedAmount).toBe(7_500); // RELIABLE tier: 75% of PO value
  });

  it("never approves more than requested even when the advance cap is higher", () => {
    const decision = scoreLoanRequest({ stsScore: 900, requestedAmount: 100, poValue: 1_000_000 });
    expect(decision.approvedAmount).toBe(100);
  });
});
