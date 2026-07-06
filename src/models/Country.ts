import "server-only";
import { Schema, model, models } from "mongoose";

export const TRADE_ZONES = ["USA", "EU", "INDIA", "CHINA", "UAE"] as const;

const countrySchema = new Schema({
  _id: { type: String }, // ISO 3166-1 alpha-2, set explicitly on create — not auto-generated
  name: { type: String, required: true },
  zone: { type: String, enum: TRADE_ZONES, required: true },
});

export const Country = models.Country || model("Country", countrySchema);
