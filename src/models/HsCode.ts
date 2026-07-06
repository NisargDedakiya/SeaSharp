import "server-only";
import { Schema, model, models } from "mongoose";

const hsCodeSchema = new Schema({
  _id: { type: String }, // HS code, set explicitly on create — not auto-generated
  description: { type: String, required: true },
  category: { type: String, required: true },
});

export const HsCode = models.HsCode || model("HsCode", hsCodeSchema);
