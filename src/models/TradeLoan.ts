import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const LOAN_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "FUNDED",
  "REPAID",
  "DEFAULTED",
  "REJECTED",
] as const;

const tradeLoanSchema = new Schema({
  exporterId: { type: Types.ObjectId, ref: "User", required: true },
  rfqId: { type: Types.ObjectId, ref: "Rfq" },
  requestedAmount: { type: Number, required: true },
  approvedAmount: { type: Number },
  interestRatePercent: { type: Number },
  riskBand: { type: String },
  status: { type: String, enum: LOAN_STATUSES, default: "REQUESTED" },
  requestedAt: { type: Date, default: Date.now },
  fundedAt: { type: Date },
  repaidAt: { type: Date },
});

tradeLoanSchema.index({ exporterId: 1, requestedAt: -1 });

export const TradeLoan = models.TradeLoan || model("TradeLoan", tradeLoanSchema);
