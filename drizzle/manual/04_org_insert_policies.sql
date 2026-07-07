-- Registration (src/lib/auth/register.ts) creates the user's first
-- organization via the service-role connection (bypasses RLS), since at
-- signup time there's no session/JWT yet for the RLS-enforced app_user
-- connection to authenticate as. These policies exist anyway for
-- defense-in-depth and for any future direct-from-client "create another
-- organization" flow:
--   - Any authenticated user can create a new organization (ownership is
--     established by the organization_members row that follows).
--   - A user may only insert themselves into organization_members when the
--     organization has zero existing members (the bootstrapping case);
--     accepting an invitation to an existing organization goes through a
--     service-role-executed flow that validates the invitation token, not
--     a direct client-side insert.
create policy authenticated_can_create_org on organizations for insert
  with check (auth.uid() is not null);

create policy self_join_new_org on organization_members for insert
  with check (
    profile_id = auth.uid()
    and not exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );
