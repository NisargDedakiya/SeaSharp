import "server-only";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { User, Shipment, Escrow, TradeLoan, StsScoreLog } from "@/models";
import { calculateStsScore, type StsBreakdown } from "@/lib/sts";

// Recomputes a user's STS from their live platform history, persists it on
// the User record, and appends an audit log entry (StsScoreLog). The update
// + log-append happen inside a replica-set transaction so the score and its
// audit trail never diverge.
export async function recalculateAndSaveSts(userId: string): Promise<StsBreakdown> {
  await dbConnect();

  const user = await User.findById(userId).orFail();

  const shipments = await Shipment.find({ exporterId: userId });
  const totalShipments = shipments.length;
  const onTimeShipments = shipments.filter(
    (s) => s.deliveredAt && s.customsClearedAt && s.status !== "DISPUTED"
  ).length;
  const disputedShipments = shipments.filter((s) => s.status === "DISPUTED").length;

  const rfqIds = shipments.map((s) => s.rfqId);
  const escrows = await Escrow.find({ rfqId: { $in: rfqIds } });
  const releaseDurations = escrows
    .filter((e) => e.fundedAt && e.releasedAt)
    .map((e) => (e.releasedAt!.getTime() - e.fundedAt!.getTime()) / (1000 * 60 * 60 * 24));
  const escrowReleaseDaysAvg =
    releaseDurations.length > 0
      ? releaseDurations.reduce((a, b) => a + b, 0) / releaseDurations.length
      : null;

  const loans = await TradeLoan.find({ exporterId: userId });
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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { _id: userId },
        { $set: { stsScore: breakdown.totalScore } },
        { session }
      );
      await StsScoreLog.create(
        [
          {
            userId,
            totalScore: breakdown.totalScore,
            kycPoints: breakdown.kycPoints,
            onTimeDeliveryPoints: breakdown.onTimeDeliveryPoints,
            escrowSpeedPoints: breakdown.escrowSpeedPoints,
            disputePoints: breakdown.disputePoints,
            loanRepaymentPoints: breakdown.loanRepaymentPoints,
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return breakdown;
}
