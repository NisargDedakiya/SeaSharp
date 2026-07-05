-- Rebrand: TradeNova -> SeaSharp, TNS -> STS (SeaSharp Trust Score).
-- Adds ecosystem roles and expands document types for the wider trade
-- lifecycle (freight forwarders, customs brokers, warehouse providers,
-- banks, insurers) per the SeaSharp v1.0 vision doc. New roles/types are
-- additive; no workflows are wired to them yet.

-- Role: new ecosystem actors
ALTER TYPE "Role" ADD VALUE 'FREIGHT_FORWARDER';
ALTER TYPE "Role" ADD VALUE 'CUSTOMS_BROKER';
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE_PROVIDER';
ALTER TYPE "Role" ADD VALUE 'BANK';
ALTER TYPE "Role" ADD VALUE 'INSURANCE_COMPANY';

-- DocumentType: full trade document set
ALTER TYPE "DocumentType" ADD VALUE 'AIR_WAYBILL';
ALTER TYPE "DocumentType" ADD VALUE 'EXPORT_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE 'IMPORT_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE 'INSURANCE_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'INSPECTION_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'FUMIGATION_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'LETTER_OF_CREDIT';
ALTER TYPE "DocumentType" ADD VALUE 'PROFORMA_INVOICE';

-- TNS -> STS renames (columns, table, constraints)
ALTER TABLE "User" RENAME COLUMN "tnsScore" TO "stsScore";
ALTER TABLE "Shipment" RENAME COLUMN "tnsScoreAtTimeOfDeal" TO "stsScoreAtTimeOfDeal";

ALTER TABLE "TnsScoreLog" RENAME TO "StsScoreLog";
ALTER TABLE "StsScoreLog" RENAME CONSTRAINT "TnsScoreLog_pkey" TO "StsScoreLog_pkey";
ALTER TABLE "StsScoreLog" RENAME CONSTRAINT "TnsScoreLog_userId_fkey" TO "StsScoreLog_userId_fkey";
