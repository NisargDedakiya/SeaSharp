CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"graph" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_definitions_name_version_unique" UNIQUE("name","version")
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_node" text NOT NULL,
	"to_node" text NOT NULL,
	"actor_profile_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"current_node" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_instances_rfq_id_unique" UNIQUE("rfq_id")
);
--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Seed the "trade-lifecycle" v1 definition so engine.ts#getOrCreateDefinition
-- finds a row on first use instead of racing to insert it itself (see
-- src/core/workflow/engine.ts's TRADE_LIFECYCLE_GRAPH, which this mirrors).
INSERT INTO "workflow_definitions" ("name", "version", "graph") VALUES (
  'trade-lifecycle',
  1,
  '{
    "INQUIRY": ["OPEN"],
    "OPEN": ["NEGOTIATION", "AWARDED", "CANCELLED"],
    "NEGOTIATION": ["CONTRACT", "CANCELLED"],
    "CONTRACT": ["AWARDED", "CANCELLED"],
    "AWARDED": ["PRODUCTION", "PICKUP"],
    "PRODUCTION": ["WAREHOUSE"],
    "WAREHOUSE": ["PICKUP"],
    "PICKUP": ["EXPORT_CUSTOMS", "CUSTOMS_CLEARED"],
    "EXPORT_CUSTOMS": ["SHIPPING"],
    "SHIPPING": ["IMPORT_CUSTOMS"],
    "IMPORT_CUSTOMS": ["CUSTOMS_CLEARED"],
    "CUSTOMS_CLEARED": ["DELIVERY"],
    "DELIVERY": ["PAYMENT", "FULFILLED"],
    "PAYMENT": ["FULFILLED"],
    "FULFILLED": [],
    "CANCELLED": []
  }'::jsonb
)
ON CONFLICT ("name", "version") DO NOTHING;