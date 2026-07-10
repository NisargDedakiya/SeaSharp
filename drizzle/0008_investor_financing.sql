ALTER TABLE "trade_loans" RENAME COLUMN "exporter_organization_id" TO "requesting_organization_id";--> statement-breakpoint
ALTER TABLE "trade_loans" RENAME CONSTRAINT "trade_loans_exporter_organization_id_organizations_id_fk" TO "trade_loans_requesting_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "trade_loans" ADD COLUMN "requesting_org_type" "organization_type" NOT NULL DEFAULT 'EXPORTER';--> statement-breakpoint
ALTER TABLE "trade_loans" ADD COLUMN "investor_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_loans" ADD CONSTRAINT "trade_loans_investor_organization_id_organizations_id_fk" FOREIGN KEY ("investor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_loans" ALTER COLUMN "requesting_org_type" DROP DEFAULT;
