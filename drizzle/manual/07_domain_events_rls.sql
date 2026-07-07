-- domain_events is the append-only event log every audit_logs/notifications
-- row is derived from (see src/core/events/). Same "org members can see
-- their own org's rows" baseline as audit_logs.
alter table domain_events enable row level security;
create policy org_members_select_domain_events on domain_events for select
  using (organization_id is null or is_org_member(organization_id));
