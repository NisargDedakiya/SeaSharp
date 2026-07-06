import "server-only";
import { Schema, model, models } from "mongoose";

const complianceDocumentSchema = new Schema({
  destinationCountry: { type: String, required: true }, // "*" means all destinations
  hsCode: { type: String, default: null },
  name: { type: String, required: true },
  description: { type: String, required: true },
  required: { type: Boolean, default: true },
});

complianceDocumentSchema.index({ destinationCountry: 1, hsCode: 1 });

export const ComplianceDocument =
  models.ComplianceDocument || model("ComplianceDocument", complianceDocumentSchema);
