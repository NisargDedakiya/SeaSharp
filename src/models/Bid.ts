import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const BID_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

const bidSchema = new Schema(
  {
    rfqId: { type: Types.ObjectId, ref: "Rfq", required: true },
    exporterId: { type: Types.ObjectId, ref: "User", required: true },
    pricePerUnit: { type: Number, required: true },
    message: { type: String },
    aiSuggestedPrice: { type: Number },
    status: { type: String, enum: BID_STATUSES, default: "PENDING" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bidSchema.index({ rfqId: 1, exporterId: 1 }, { unique: true });

export const Bid = models.Bid || model("Bid", bidSchema);
