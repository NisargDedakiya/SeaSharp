-- api_keys / webhook_endpoints / webhook_deliveries are org-scoped
-- integration config + delivery logs (Task 6's Public API Platform) — same
-- "org members can see their own org's rows" treatment as
-- workflow_instances/workflow_history (08_workflow_rls.sql). Secrets
-- (hashed_secret, secret) are never exposed to the client bundle regardless
-- of RLS — every read/write goes through serviceDb (the service-role
-- connection) in src/core/api-platform/keys.ts and the route handlers, same
-- as every other privileged write path in this codebase; RLS here is the
-- defense-in-depth backstop for the eventual client-side/APP_DATABASE_URL
-- reads, not the primary access control.

alter table api_keys enable row level security;
create policy org_members_select_api_keys on api_keys for select
  using (is_org_member(organization_id));

alter table webhook_endpoints enable row level security;
create policy org_members_select_webhook_endpoints on webhook_endpoints for select
  using (is_org_member(organization_id));

alter table webhook_deliveries enable row level security;
create policy org_members_select_webhook_deliveries on webhook_deliveries for select
  using (is_org_member(organization_id));
