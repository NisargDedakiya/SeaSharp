import { prisma } from "@/lib/prisma";
import { KycStatus } from "@prisma/client";

// SeaSharp Trust Score (STS) — composite 0-1000 credit score for exporters.
// Weights come directly from the product spec (section 07).
export const STS_WEIGHTS = {
  kyc: 200,
  onTimeDelivery: 240,
  escrowSpeed: 200,
  disputeRate: 200,
  loanRepayment: 160,
} as const;

export type StsBreakdown = {
  kycPoints: number;
  onTimeDeliveryPoints: number;
  escrowSpeedPoints: number;
  disputePoints: number;
  loanRepaymentPoints: number;
  totalScore: number;
  tier: StsTier;
};

export type StsTier = "NEW" | "VERIFIED" | "RELIABLE" | "TRUSTED_PARTNER";

export function tierForScore(score: number): StsTier {
  if (score >= 801) return "TRUSTED_PARTNER";
  if (score >= 651) return "RELIABLE";
  if (score >= 401) return "VERIFIED";
  return "NEW";
}

export const STS_TIER_LABELS: Record<StsTier, string> = {
  NEW: "New",
  VERIFIED: "Verified",
  RELIABLE: "Reliable",
  TRUSTED_PARTNER: "Trusted Partner",
};

type CalculateInput = {
  kycStatus: KycStatus;
  totalShipments: number;
  onTimeShipments: number;
  escrowReleaseDaysAvg: number | null; // average days from delivery to escrow release
  disputedShipments: number;
  totalLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
};

// Pure scoring function — no I/O, easy to reason about and test.
export function calculateStsScore(input: CalculateInput): StsBreakdown {
  const kycPoints = input.kycStatus === "VERIFIED" ? STS_WEIGHTS.kyc : 0;

  const onTimeRate =
    input.totalShipments > 0 ? input.onTimeShipments / input.totalShipments : null;
  const onTimeDeliveryPoints =
    onTimeRate === null
      ? Math.round(STS_WEIGHTS.onTimeDelivery * 0.5) // no history yet -> neutral half credit
      : Math.round(STS_WEIGHTS.onTimeDelivery * onTimeRate);

  let escrowSpeedPoints: number;
  if (input.escrowReleaseDaysAvg === null) {
    escrowSpeedPoints = Math.round(STS_WEIGHTS.escrowSpeed * 0.5);
  } else if (input.escrowReleaseDaysAvg <= 5) {
    escrowSpeedPoints = STS_WEIGHTS.escrowSpeed;
  } else if (input.escrowReleaseDaysAvg >= 20) {
    escrowSpeedPoints = 0;
  } else {
    // linear decay between the 5-day target and the 20-day floor
    const fraction = 1 - (input.escrowReleaseDaysAvg - 5) / 15;
    escrowSpeedPoints = Math.round(STS_WEIGHTS.escrowSpeed * fraction);
  }

  const disputeRate =
    input.totalShipments > 0 ? input.disputedShipments / input.totalShipments : 0;
  const disputePoints = Math.round(STS_WEIGHTS.disputeRate * Math.max(0, 1 - disputeRate * 4));

  let loanRepaymentPoints: number;
  if (input.totalLoans === 0) {
    loanRepaymentPoints = Math.round(STS_WEIGHTS.loanRepayment * 0.5);
  } else if (input.defaultedLoans > 0) {
    loanRepaymentPoints = 0;
  } else {
    loanRepaymentPoints = Math.round(
      STS_WEIGHTS.loanRepayment * (input.repaidLoans / input.totalLoans)
    );
  }

  const totalScore =
    kycPoints + onTimeDeliveryPoints + escrowSpeedPoints + disputePoints + loanRepaymentPoints;

  return {
    kycPoints,
    onTimeDeliveryPoints,
    escrowSpeedPoints,
    disputePoints,
    loanRepaymentPoints,
    totalScore,
    tier: tierForScore(totalScore),
  };
}

// Recomputes a user's STS from their live platform history, persists it on
// the User record, and appends an audit log entry (StsScoreLog).
export async function recalculateAndSaveSts(userId: string): Promise<StsBreakdown> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const shipments = await prisma.shipment.findMany({ where: { exporterId: userId } });
  const totalShipments = shipments.length;
  const onTimeShipments = shipments.filter(
    (s) => s.deliveredAt && s.customsClearedAt && s.status !== "DISPUTED"
  ).length;
  const disputedShipments = shipments.filter((s) => s.status === "DISPUTED").length;

  const escrows = await prisma.escrow.findMany({
    where: { rfq: { shipment: { exporterId: userId } } },
  });
  const releaseDurations = escrows
    .filter((e) => e.fundedAt && e.releasedAt)
    .map((e) => (e.releasedAt!.getTime() - e.fundedAt!.getTime()) / (1000 * 60 * 60 * 24));
  const escrowReleaseDaysAvg =
    releaseDurations.length > 0
      ? releaseDurations.reduce((a, b) => a + b, 0) / releaseDurations.length
      : null;

  const loans = await prisma.tradeLoan.findMany({ where: { exporterId: userId } });
  const totalLoans = loans.length;
  const repaidLoans = loans.filter((l) => l.status === "REPAID").length;
  const defaultedLoans = loans.filter((l) => l.status === "DEFAULTED").length;

  const breakdown = calculateStsScore({
    kycStatus: user.kycStatus,
    totalShipments,
    onTimeShipments,
    escrowReleaseDaysAvg,
    disputedShipments,
    totalLoans,
    repaidLoans,
    defaultedLoans,
  });

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { stsScore: breakdown.totalScore } }),
    prisma.stsScoreLog.create({
      data: {
        userId,
        totalScore: breakdown.totalScore,
        kycPoints: breakdown.kycPoints,
        onTimeDeliveryPoints: breakdown.onTimeDeliveryPoints,
        escrowSpeedPoints: breakdown.escrowSpeedPoints,
        disputePoints: breakdown.disputePoints,
        loanRepaymentPoints: breakdown.loanRepaymentPoints,
      },
    }),
  ]);

  return breakdown;
}
