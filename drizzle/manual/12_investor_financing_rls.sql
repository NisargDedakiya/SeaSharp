-- trade_loan_org_select (01_rls_and_roles.sql) only let the requesting
-- (borrower) organization see its own loan rows. Now that a loan can be
-- funded by a separate INVESTOR organization (trade_loans.investor_organization_id,
-- see 0008_investor_financing.sql), extend the policy so: the funding
-- investor can see loans it has committed capital to, and any INVESTOR-org
-- member can see APPROVED, not-yet-funded requests (the open investment
-- marketplace read GET /api/investments serves). Same defense-in-depth
-- role RLS plays elsewhere in this file — the app's actual reads go
-- through serviceDb (service-role), see docs/06-api-integration-spec.md.
drop policy if exists trade_loan_org_select on trade_loans;
create policy trade_loan_org_select on trade_loans for select
  using (
    is_org_member(requesting_organization_id)
    or (investor_organization_id is not null and is_org_member(investor_organization_id))
    or (
      status = 'APPROVED' and investor_organization_id is null
      and exists (
        select 1 from organization_members om
        join organizations o on o.id = om.organization_id
        where om.profile_id = auth.uid() and o.type = 'INVESTOR'
      )
    )
  );
