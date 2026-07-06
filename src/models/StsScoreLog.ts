import "server-only";
import { Schema, model, models, Types } from "mongoose";

const stsScoreLogSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  totalScore: { type: Number, required: true },
  kycPoints: { type: Number, required: true },
  onTimeDeliveryPoints: { type: Number, required: true },
  escrowSpeedPoints: { type: Number, required: true },
  disputePoints: { type: Number, required: true },
  loanRepaymentPoints: { type: Number, required: true },
  calculatedAt: { type: Date, default: Date.now },
});

stsScoreLogSchema.index({ userId: 1, calculatedAt: -1 });

export const StsScoreLog = models.StsScoreLog || model("StsScoreLog", stsScoreLogSchema);
