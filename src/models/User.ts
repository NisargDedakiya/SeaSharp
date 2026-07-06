import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ROLES = [
  "EXPORTER",
  "IMPORTER",
  "ADMIN",
  // Ecosystem roles (schema-ready; full workflows land in a later phase).
  "FREIGHT_FORWARDER",
  "CUSTOMS_BROKER",
  "WAREHOUSE_PROVIDER",
  "BANK",
  "INSURANCE_COMPANY",
] as const;

export const KYC_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    companyName: { type: String },
    country: { type: String },
    phone: { type: String },

    kycStatus: { type: String, enum: KYC_STATUSES, default: "UNVERIFIED" },
    kycSubmittedAt: { type: Date },
    kycVerifiedAt: { type: Date },

    stsScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User = models.User || model("User", userSchema);
