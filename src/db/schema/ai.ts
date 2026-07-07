import { pgTable, uuid, text, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";

// Generic shape shared by every AI service (TradeAI, ComplianceAI, RouteAI,
// SupplierRadar, RiskAI, CreditLayer, PriceAI, MarketAI, DocAI, FraudAI) so
// adding a new service never requires a migration against a core domain
// table. See docs/04-database-design.md#ai-domain.
export const aiPredictions = pgTable("ai_predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceName: text("service_name").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  modelVersion: text("model_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiLogs = pgTable("ai_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceName: text("service_name").notNull(),
  requestId: text("request_id"),
  level: text("level").default("info").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const routePredictions = pgTable("route_predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").notNull(),
  recommendedRoute: jsonb("recommended_route").notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }),
  estimatedDays: numeric("estimated_days", { precision: 6, scale: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const riskScores = pgTable("risk_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  score: numeric("score", { precision: 6, scale: 2 }).notNull(),
  factors: jsonb("factors").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
