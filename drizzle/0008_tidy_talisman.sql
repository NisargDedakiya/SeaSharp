CREATE TABLE "kyc_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submitted_by_profile_id" uuid,
	"legal_company_name" text NOT NULL,
	"registration_number" text NOT NULL,
	"tax_id" text NOT NULL,
	"country" text NOT NULL,
	"beneficial_owners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"registration_document_file_id" uuid,
	"tax_document_file_id" uuid,
	"status" "kyc_status" DEFAULT 'PENDING' NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_submitted_by_profile_id_profiles_id_fk" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_registration_document_file_id_uploaded_files_id_fk" FOREIGN KEY ("registration_document_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_tax_document_file_id_uploaded_files_id_fk" FOREIGN KEY ("tax_document_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_submissions_org_idx" ON "kyc_submissions" USING btree ("organization_id");