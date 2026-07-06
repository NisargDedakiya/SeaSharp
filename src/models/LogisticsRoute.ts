import "server-only";
import { Schema, model, models, Types } from "mongoose";
import { FREIGHT_MODES } from "@/models/Shipment";

const logisticsRouteSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    tradeId: { type: String, required: true },
    originLocation: { type: String, required: true },
    destinationLocation: { type: String, required: true },
    mode: { type: String, enum: FREIGHT_MODES, required: true },
    estimatedCost: { type: Number, required: true },
    actualCost: { type: Number },
    carrierId: { type: String },
    status: { type: String, default: "PLANNED" },
    customsClearedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LogisticsRoute = models.LogisticsRoute || model("LogisticsRoute", logisticsRouteSchema);
