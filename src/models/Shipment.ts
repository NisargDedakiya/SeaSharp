import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const FREIGHT_MODES = ["SEA", "AIR", "ROAD"] as const;

export const TRANSPORT_STAGES = [
  "PICKUP",
  "PORT_TRANSIT",
  "INTERNATIONAL_FREIGHT",
  "CUSTOMS_CLEARANCE",
  "DELIVERY",
  "COMPLETE",
] as const;

const shipmentSchema = new Schema(
  {
    rfqId: { type: Types.ObjectId, ref: "Rfq", required: true, unique: true },
    exporterId: { type: Types.ObjectId, ref: "User", required: true },
    importerId: { type: Types.ObjectId, ref: "User", required: true },
    mode: { type: String, enum: FREIGHT_MODES, required: true },
    transportStage: { type: String, enum: TRANSPORT_STAGES, default: "PICKUP" },
    status: { type: String, default: "IN_PROGRESS" },
    trackingNumber: { type: String },
    originLocation: { type: String, required: true },
    destinationLocation: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    actualCost: { type: Number },
    customsClearedAt: { type: Date },
    deliveredAt: { type: Date },
    stsScoreAtTimeOfDeal: { type: Number, required: true },
    aiRouteRecommendation: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shipmentSchema.index({ exporterId: 1 });

export const Shipment = models.Shipment || model("Shipment", shipmentSchema);
