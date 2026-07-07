-- compliance_documents was added after the initial RLS pass (see
-- drizzle/0001_trade_intelligence_parity.sql) — it's reference data for the
-- public Compliance Checker, same open-read/service-role-write treatment as
-- countries/hs_codes/tariffs/etc. in 01_rls_and_roles.sql.
grant select on compliance_documents to authenticated;
