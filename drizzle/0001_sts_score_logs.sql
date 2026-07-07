CREATE TABLE "sts_score_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"total_score" integer NOT NULL,
	"kyc_points" integer NOT NULL,
	"on_time_delivery_points" integer NOT NULL,
	"escrow_speed_points" integer NOT NULL,
	"dispute_points" integer NOT NULL,
	"loan_repayment_points" integer NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sts_score_logs" ADD CONSTRAINT "sts_score_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;