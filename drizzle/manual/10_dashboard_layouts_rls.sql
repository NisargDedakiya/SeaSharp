-- dashboard_layouts (Task 5 — widget-based dashboard) holds one row per
-- profile+organization: purely a user preference, same treatment as
-- notification_preferences (which has no RLS beyond the default
-- authenticated grant, since a profile's own preferences are only ever
-- read/written by that profile via serviceDb behind getSessionActor()).
--
-- Unlike notification_preferences though, this table also carries
-- organization_id, and its data (which widgets show, in what order) isn't
-- sensitive cross-org info, but a profile should still only ever see/edit
-- its own layout rows, org-scoped like the workflow/audit tables via
-- is_org_member — not any other profile's, even within the same org.
alter table dashboard_layouts enable row level security;

create policy own_select_dashboard_layouts on dashboard_layouts for select
  using (profile_id = auth.uid() and is_org_member(organization_id));

create policy own_insert_dashboard_layouts on dashboard_layouts for insert
  with check (profile_id = auth.uid() and is_org_member(organization_id));

create policy own_update_dashboard_layouts on dashboard_layouts for update
  using (profile_id = auth.uid() and is_org_member(organization_id))
  with check (profile_id = auth.uid() and is_org_member(organization_id));
