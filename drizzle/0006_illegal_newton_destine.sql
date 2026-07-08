CREATE TABLE "dashboard_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"widgets" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_layouts_profile_id_organization_id_unique" UNIQUE("profile_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
-- Note: drizzle-kit's diff engine doesn't track 0005_search_fts.sql's
-- functional (expression) GIN indexes since they were added by hand rather
-- than through the Drizzle TS schema (see that migration's header comment).
-- It therefore wants to DROP "hs_codes_fts_idx"/"rfqs_fts_idx" here on every
-- future `drizzle-kit generate` run — that DROP is intentionally omitted so
-- Task 4's full-text search indexes are never destroyed by this migration.