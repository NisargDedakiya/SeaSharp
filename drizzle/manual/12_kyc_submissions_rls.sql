-- kyc_submissions is org-scoped KYC/KYB submission history (see
-- docs/02-product-requirements.md §1.4) — same "org members can see their
-- own org's rows" treatment as api_keys/webhook_endpoints
-- (11_api_platform_rls.sql). All writes (submit + upload) go through
-- serviceDb in src/app/api/verification/*, same as every other privileged
-- write path in this codebase; RLS is the defense-in-depth backstop for
-- the eventual client-side/APP_DATABASE_URL reads, not the primary access
-- control.

alter table kyc_submissions enable row level security;
create policy org_members_select_kyc_submissions on kyc_submissions for select
  using (is_org_member(organization_id));
