CREATE TYPE "public"."deal_status" AS ENUM('CONFIRMED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."funding_request_kind" AS ENUM('LOAN', 'ADVANCE');--> statement-breakpoint
CREATE TYPE "public"."funding_request_status" AS ENUM('OPEN', 'FUNDED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"importer_organization_id" uuid NOT NULL,
	"exporter_organization_id" uuid NOT NULL,
	"total_value" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "deal_status" DEFAULT 'CONFIRMED' NOT NULL,
	"confirmed_by_profile_id" uuid,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_rfq_id_unique" UNIQUE("rfq_id")
);
--> statement-breakpoint
CREATE TABLE "funding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"exporter_organization_id" uuid NOT NULL,
	"kind" "funding_request_kind" DEFAULT 'LOAN' NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"note" text,
	"status" "funding_request_status" DEFAULT 'OPEN' NOT NULL,
	"funder_organization_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_importer_organization_id_organizations_id_fk" FOREIGN KEY ("importer_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_exporter_organization_id_organizations_id_fk" FOREIGN KEY ("exporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_exporter_organization_id_organizations_id_fk" FOREIGN KEY ("exporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_funder_organization_id_organizations_id_fk" FOREIGN KEY ("funder_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;