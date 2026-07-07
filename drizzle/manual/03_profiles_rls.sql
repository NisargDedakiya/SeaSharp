-- profiles was missed in 0001_rls_and_roles.sql's pass — every profile
-- needs to be selectable by its owner and by anyone who shares an
-- organization with them (so org member lists can show teammates' names).
alter table profiles enable row level security;

create policy profiles_self_select on profiles for select
  using (id = auth.uid());

create policy profiles_org_mates_select on profiles for select
  using (exists (
    select 1 from organization_members om1
    join organization_members om2 on om1.organization_id = om2.organization_id
    where om1.profile_id = profiles.id and om2.profile_id = auth.uid()
  ));

create policy profiles_self_update on profiles for update
  using (id = auth.uid());
