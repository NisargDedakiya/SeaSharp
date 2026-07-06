import "server-only";
import { Schema, model, models, Types } from "mongoose";

export const DOCUMENT_TYPES = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "EXPORT_DECLARATION",
  "IMPORT_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "INSPECTION_CERTIFICATE",
  "FUMIGATION_CERTIFICATE",
  "LETTER_OF_CREDIT",
  "PROFORMA_INVOICE",
] as const;

const documentSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  rfqId: { type: Types.ObjectId, ref: "Rfq" },
  type: { type: String, enum: DOCUMENT_TYPES, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Document = models.Document || model("Document", documentSchema);
