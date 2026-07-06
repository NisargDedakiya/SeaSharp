import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const RFQ_STATUSES = ["OPEN", "AWARDED", "CANCELLED", "FULFILLED"] as const;

const rfqSchema = new Schema(
  {
    importerId: { type: Types.ObjectId, ref: "User", required: true },
    product: { type: String, required: true },
    hsCode: { type: String, required: true },
    originCountry: { type: String, required: true },
    destinationCountry: { type: String, required: true },
    volume: { type: Number, required: true },
    unit: { type: String, required: true },
    targetPricePerUnit: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    deadline: { type: Date, required: true },
    status: { type: String, enum: RFQ_STATUSES, default: "OPEN" },
    awardedBidId: { type: Types.ObjectId, ref: "Bid", default: null },
  },
  { timestamps: true }
);

rfqSchema.index({ status: 1, createdAt: -1 });
rfqSchema.index({ importerId: 1 });

export const Rfq = models.Rfq || model("Rfq", rfqSchema);
