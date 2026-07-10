CREATE SCHEMA IF NOT EXISTS "auth";--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('EXPORTER', 'IMPORTER', 'FREIGHT_FORWARDER', 'CUSTOMS_BROKER', 'WAREHOUSE_PROVIDER', 'INSURANCE_PROVIDER', 'FINANCE_PARTNER', 'INVESTOR');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN', 'BILL_OF_LADING', 'AIR_WAYBILL', 'EXPORT_DECLARATION', 'IMPORT_DECLARATION', 'INSURANCE_CERTIFICATE', 'INSPECTION_CERTIFICATE', 'FUMIGATION_CERTIFICATE', 'LETTER_OF_CREDIT', 'PROFORMA_INVOICE');--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('OPEN', 'AWARDED', 'CANCELLED', 'FULFILLED');--> statement-breakpoint
CREATE TYPE "public"."freight_mode" AS ENUM('SEA', 'AIR', 'ROAD');--> statement-breakpoint
CREATE TYPE "public"."transport_stage" AS ENUM('PICKUP', 'PORT_TRANSIT', 'INTERNATIONAL_FREIGHT', 'CUSTOMS_CLEARANCE', 'DELIVERY', 'COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('PENDING', 'FUNDED', 'PARTIALLY_RELEASED', 'RELEASED', 'DISPUTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('PENDING', 'COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."trade_loan_status" AS ENUM('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'FUNDED', 'REPAID', 'DEFAULTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"email_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_profile_id_unique" UNIQUE("organization_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"country" text,
	"kyc_status" "kyc_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"sts_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"avatar_url" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_country" text NOT NULL,
	"hs_code" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text
);
--> statement-breakpoint
CREATE TABLE "hs_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"unlocode" text,
	CONSTRAINT "ports_unlocode_unique" UNIQUE("unlocode")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hs_code" text,
	"default_unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restricted_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs_code" text NOT NULL,
	"country_code" text,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs_code" text NOT NULL,
	"origin_country" text NOT NULL,
	"destination_country" text NOT NULL,
	"duty_rate_percent" numeric(6, 3) NOT NULL,
	"additional_fee_percent" numeric(6, 3) DEFAULT '0' NOT NULL,
	"notes" text,
	CONSTRAINT "tariffs_hs_code_origin_country_destination_country_unique" UNIQUE("hs_code","origin_country","destination_country")
);
--> statement-breakpoint
CREATE TABLE "trade_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"hs_code" text,
	"required_documents" jsonb NOT NULL,
	"required_certificates" jsonb,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"storage_path" text NOT NULL,
	"generated_by" text DEFAULT 'USER' NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"price_per_unit" numeric(14, 4) NOT NULL,
	"message" text,
	"ai_suggested_price" numeric(14, 4),
	"status" "bid_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_rfq_id_organization_id_unique" UNIQUE("rfq_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"terms" jsonb NOT NULL,
	"document_id" uuid,
	"importer_signed_at" timestamp with time zone,
	"exporter_signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"proposed_by_organization_id" uuid NOT NULL,
	"price_per_unit" numeric(14, 4) NOT NULL,
	"message" text,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"product_id" uuid,
	"volume" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"target_price_per_unit" numeric(14, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product" text NOT NULL,
	"hs_code" text NOT NULL,
	"origin_country" text NOT NULL,
	"destination_country" text NOT NULL,
	"volume" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"target_price_per_unit" numeric(14, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" "rfq_status" DEFAULT 'OPEN' NOT NULL,
	"awarded_bid_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scac_code" text
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"container_number" text NOT NULL,
	"seal_number" text
);
--> statement-breakpoint
CREATE TABLE "freight_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"carrier_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"booked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "logistics_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_port_id" uuid,
	"destination_port_id" uuid,
	"mode" text NOT NULL,
	"estimated_days" numeric(6, 1),
	"estimated_cost_per_unit" numeric(14, 4)
);
--> statement-breakpoint
CREATE TABLE "shipment_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"stage" "transport_stage" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"exporter_organization_id" uuid NOT NULL,
	"importer_organization_id" uuid NOT NULL,
	"mode" "freight_mode" NOT NULL,
	"transport_stage" "transport_stage" DEFAULT 'PICKUP' NOT NULL,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"tracking_number" text,
	"origin_location" text NOT NULL,
	"destination_location" text NOT NULL,
	"estimated_cost" numeric(14, 2) NOT NULL,
	"actual_cost" numeric(14, 2),
	"customs_cleared_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"sts_score_at_time_of_deal" numeric(6, 0) NOT NULL,
	"ai_route_recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_rfq_id_unique" UNIQUE("rfq_id")
);
--> statement-breakpoint
CREATE TABLE "escrow_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "escrow_status" DEFAULT 'PENDING' NOT NULL,
	"funded_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_accounts_rfq_id_unique" UNIQUE("rfq_id")
);
--> statement-breakpoint
CREATE TABLE "escrow_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" "milestone_status" DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid,
	"organization_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"escrow_account_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_event_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "trade_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid,
	"exporter_organization_id" uuid NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"approved_amount" numeric(14, 2),
	"interest_rate_percent" numeric(6, 3),
	"risk_band" text,
	"status" "trade_loan_status" DEFAULT 'REQUESTED' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funded_at" timestamp with time zone,
	"repaid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "wallets_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"request_id" text,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"confidence" numeric(5, 4),
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"factors" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"recommended_route" jsonb NOT NULL,
	"estimated_cost" numeric(14, 2),
	"estimated_days" numeric(6, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"notification_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_preferences_profile_id_channel_notification_type_unique" UNIQUE("profile_id","channel","notification_type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ports" ADD CONSTRAINT "ports_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_hs_code_hs_codes_code_fk" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_products" ADD CONSTRAINT "restricted_products_hs_code_hs_codes_code_fk" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_products" ADD CONSTRAINT "restricted_products_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_hs_code_hs_codes_code_fk" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_origin_country_countries_code_fk" FOREIGN KEY ("origin_country") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_destination_country_countries_code_fk" FOREIGN KEY ("destination_country") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_rules" ADD CONSTRAINT "trade_rules_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_rules" ADD CONSTRAINT "trade_rules_hs_code_hs_codes_code_fk" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_proposed_by_organization_id_organizations_id_fk" FOREIGN KEY ("proposed_by_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_hs_code_hs_codes_code_fk" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_origin_country_countries_code_fk" FOREIGN KEY ("origin_country") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_destination_country_countries_code_fk" FOREIGN KEY ("destination_country") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_quotes" ADD CONSTRAINT "freight_quotes_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_quotes" ADD CONSTRAINT "freight_quotes_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_routes" ADD CONSTRAINT "logistics_routes_origin_port_id_ports_id_fk" FOREIGN KEY ("origin_port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_routes" ADD CONSTRAINT "logistics_routes_destination_port_id_ports_id_fk" FOREIGN KEY ("destination_port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_tracking" ADD CONSTRAINT "shipment_tracking_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_exporter_organization_id_organizations_id_fk" FOREIGN KEY ("exporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_importer_organization_id_organizations_id_fk" FOREIGN KEY ("importer_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_milestones" ADD CONSTRAINT "escrow_milestones_escrow_account_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_account_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_escrow_account_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_account_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_loans" ADD CONSTRAINT "trade_loans_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_loans" ADD CONSTRAINT "trade_loans_exporter_organization_id_organizations_id_fk" FOREIGN KEY ("exporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;