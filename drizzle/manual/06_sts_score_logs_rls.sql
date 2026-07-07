-- sts_score_logs was added after the initial RLS pass — same "org members
-- can see their own org's audit trail" treatment as audit_logs.
alter table sts_score_logs enable row level security;
create policy org_members_select_sts_score_logs on sts_score_logs for select
  using (is_org_member(organization_id));
