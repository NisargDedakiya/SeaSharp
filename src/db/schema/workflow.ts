import { pgTable, uuid, text, timestamp, jsonb, integer, unique, index } from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { rfqs } from "./marketplace";

// The unified trade-lifecycle workflow engine (src/core/workflow/engine.ts).
// Before this table set existed, state was split across three independent
// fields (rfqs.status, escrow_milestones.status, shipments.transportStage —
// see the header comment that used to live in
// src/core/workflow/trade-workflow.ts). These three tables give every
// in-flight trade a single graph-validated position instead.

// A named, versioned transition graph — generalizes the
// `Record<string, string[]>` shape that RFQ_TRANSITIONS already used
// in trade-workflow.ts, rather than inventing a new graph format.
// `graph` shape: { [node]: string[] of allowed next nodes }.
export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    graph: jsonb("graph").$type<Record<string, string[]>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.name, table.version)]
);

// One row per in-flight trade. `currentNode` is validated against its
// definition's `graph` on every transition by engine.ts#advance — this
// replaces rfqs.status/shipments.transportStage as the source of truth for
// "where is this trade right now," though those columns are kept in sync
// for now since other routes/queries still read them directly (see
// docs/04-database-design.md#workflow-domain).
export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowDefinitionId: uuid("workflow_definition_id")
    .notNull()
    .references(() => workflowDefinitions.id),
  rfqId: uuid("rfq_id")
    .notNull()
    .unique()
    .references(() => rfqs.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  currentNode: text("current_node").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Immutable per-transition record — the durable read-model for "show me
// this trade's timeline" (Task 2's audit timeline reads this table).
//
// Note on why there is no separate `workflow_events` table: the task calls
// for both a `workflow_events` and a `workflow_history` table, but a
// workflow transition already IS a domain event (src/core/events/bus.ts),
// and domain_events is already the append-only, queryable-by-payload event
// log every other domain writes to. Adding a second `workflow_events` table
// would just be domain_events with fewer columns and a second write path to
// keep in sync. Instead, engine.ts#advance emits a `WORKFLOW_TRANSITIONED`
// domain event (queryable via domain_events.payload->>'workflowInstanceId')
// AND writes this workflow_history row in the same business transaction —
// workflow_history is the fast, workflow-instance-scoped read model;
// domain_events remains the cross-domain event log the rest of the platform
// (audit log, notifications) already subscribes to.
export const workflowHistory = pgTable(
  "workflow_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowInstanceId: uuid("workflow_instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fromNode: text("from_node").notNull(),
    toNode: text("to_node").notNull(),
    actorProfileId: uuid("actor_profile_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // Postgres doesn't auto-index foreign keys, and src/core/audit/timeline.ts
  // joins workflow_instances -> workflow_history on this column for every
  // audit timeline read — index it rather than let that join degrade to a
  // seq scan as history grows.
  (table) => [index("workflow_history_instance_id_idx").on(table.workflowInstanceId)]
);
