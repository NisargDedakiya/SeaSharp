import { tierForScore, type TnsTier } from "@/lib/tns";

export type LoanDecision = {
  approved: boolean;
  approvedAmount: number | null;
  interestRatePercent: number | null;
  riskBand: string;
  reason: string;
};

const RATE_BY_TIER: Record<TnsTier, number | null> = {
  TRUSTED_PARTNER: 8,
  RELIABLE: 11,
  VERIFIED: 15,
  NEW: null, // not enough history to price risk yet
};

const ADVANCE_RATE_BY_TIER: Record<TnsTier, number> = {
  TRUSTED_PARTNER: 0.9,
  RELIABLE: 0.75,
  VERIFIED: 0.6,
  NEW: 0,
};

// CreditLayer stub: scores a PO-financing request off the exporter's TNS
// (spec section 06 / 14). TNS-gated rates create the virtuous cycle
// described in section 07 — better behavior unlocks cheaper capital.
export function scoreLoanRequest(params: {
  tnsScore: number;
  requestedAmount: number;
  poValue: number;
}): LoanDecision {
  const tier = tierForScore(params.tnsScore);
  const rate = RATE_BY_TIER[tier];
  const advanceRate = ADVANCE_RATE_BY_TIER[tier];

  if (rate === null || advanceRate === 0) {
    return {
      approved: false,
      approvedAmount: null,
      interestRatePercent: null,
      riskBand: tier,
      reason: "TNS score too new to price PO-backed credit risk. Build shipment history to unlock financing.",
    };
  }

  const maxAdvance = Math.round(params.poValue * advanceRate * 100) / 100;
  const approvedAmount = Math.min(params.requestedAmount, maxAdvance);

  return {
    approved: true,
    approvedAmount,
    interestRatePercent: rate,
    riskBand: tier,
    reason: `Approved at ${advanceRate * 100}% of verified PO value based on ${tier} tier.`,
  };
}
