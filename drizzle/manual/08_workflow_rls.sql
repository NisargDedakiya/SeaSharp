-- workflow_instances / workflow_history are org-scoped, append-mostly
-- tables — same "org members can see their own org's rows" treatment as
-- domain_events/sts_score_logs. workflow_definitions is reference data
-- (the named/versioned transition graphs themselves, not a trade's data) —
-- same open-read/service_role-write treatment as countries/hs_codes/tariffs
-- in 01_rls_and_roles.sql (no RLS needed, just a grant).
grant select on workflow_definitions to authenticated;

alter table workflow_instances enable row level security;
create policy org_members_select_workflow_instances on workflow_instances for select
  using (is_org_member(organization_id));

alter table workflow_history enable row level security;
create policy org_members_select_workflow_history on workflow_history for select
  using (is_org_member(organization_id));
