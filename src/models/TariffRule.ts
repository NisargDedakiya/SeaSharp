import "server-only";
import { Schema, model, models } from "mongoose";

const tariffRuleSchema = new Schema({
  hsCode: { type: String, required: true, ref: "HsCode" },
  originCountry: { type: String, required: true },
  destinationCountry: { type: String, required: true },
  tariffPercent: { type: Number, required: true },
  additionalFeePercent: { type: Number, default: 0 },
  notes: { type: String },
});

tariffRuleSchema.index({ hsCode: 1, originCountry: 1, destinationCountry: 1 }, { unique: true });

export const TariffRule = models.TariffRule || model("TariffRule", tariffRuleSchema);
