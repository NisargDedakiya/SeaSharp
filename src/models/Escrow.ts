import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const ESCROW_STATUSES = [
  "PENDING",
  "FUNDED",
  "PARTIALLY_RELEASED",
  "RELEASED",
  "DISPUTED",
  "REFUNDED",
] as const;

export const MILESTONE_STATUSES = ["PENDING", "COMPLETE"] as const;

const milestoneSchema = new Schema({
  name: { type: String, required: true },
  sequence: { type: Number, required: true },
  status: { type: String, enum: MILESTONE_STATUSES, default: "PENDING" },
  completedAt: { type: Date, default: null },
});

const escrowSchema = new Schema(
  {
    rfqId: { type: Types.ObjectId, ref: "Rfq", required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ESCROW_STATUSES, default: "PENDING" },
    fundedAt: { type: Date },
    releasedAt: { type: Date },
    // Milestones are always read/written together with their escrow, so
    // they're embedded rather than a separate collection.
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Escrow = models.Escrow || model("Escrow", escrowSchema);
