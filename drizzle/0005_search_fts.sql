-- Postgres-native full-text search for the two domains with real data today
-- (HS Codes, RFQs). Functional (expression) GIN indexes on to_tsvector(...)
-- rather than stored generated tsvector columns — mirrors the expression
-- index style already used in 0004_audit_timeline_indexes.sql and keeps the
-- Drizzle TS schema untouched (no new columns to keep in sync). Queries in
-- src/core/search/*.ts must use the identical to_tsvector(...) expression
-- for Postgres to use these indexes.
CREATE INDEX "hs_codes_fts_idx" ON "hs_codes" USING gin (to_tsvector('english', "code" || ' ' || "description" || ' ' || "category"));--> statement-breakpoint
CREATE INDEX "rfqs_fts_idx" ON "rfqs" USING gin (to_tsvector('english', "product" || ' ' || "hs_code"));
