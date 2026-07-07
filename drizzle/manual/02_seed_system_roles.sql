-- Seeds the system-default roles (organization_id is null, shared across
-- every organization) and the permission keys referenced by
-- 0001_rls_and_roles.sql's policies and src/lib/auth. Idempotent — safe to
-- re-run.

insert into permissions (key, description)
select * from (values
  ('organization.update', 'Update organization profile'),
  ('organization.manage_members', 'Add, remove, or re-role organization members'),
  ('invitation.create', 'Invite new members to the organization')
) as v(key, description)
where not exists (select 1 from permissions p where p.key = v.key);

do $$
declare
  owner_role_id uuid;
  admin_role_id uuid;
  member_role_id uuid;
begin
  select id into owner_role_id from roles where organization_id is null and name = 'Owner';
  if owner_role_id is null then
    insert into roles (organization_id, name) values (null, 'Owner') returning id into owner_role_id;
  end if;

  select id into admin_role_id from roles where organization_id is null and name = 'Admin';
  if admin_role_id is null then
    insert into roles (organization_id, name) values (null, 'Admin') returning id into admin_role_id;
  end if;

  select id into member_role_id from roles where organization_id is null and name = 'Member';
  if member_role_id is null then
    insert into roles (organization_id, name) values (null, 'Member') returning id into member_role_id;
  end if;

  -- Owner: every permission.
  insert into role_permissions (role_id, permission_id)
  select owner_role_id, p.id from permissions p
  where not exists (
    select 1 from role_permissions rp where rp.role_id = owner_role_id and rp.permission_id = p.id
  );

  -- Admin: member management, but not the org's own profile fields.
  insert into role_permissions (role_id, permission_id)
  select admin_role_id, p.id from permissions p
  where p.key in ('organization.manage_members', 'invitation.create')
    and not exists (
      select 1 from role_permissions rp where rp.role_id = admin_role_id and rp.permission_id = p.id
    );

  -- Member: no elevated permissions (read access comes from is_org_member(), not a permission row).
end
$$;
