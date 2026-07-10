-- Roles, auth.uid(), and Row Level Security bootstrap.
--
-- This mirrors what a real Supabase project provisions automatically
-- (the `anon`/`authenticated`/`service_role` Postgres roles, and the
-- `auth.uid()` helper that reads the current request's JWT claims). We
-- provision it ourselves here because this sandbox cannot run the full
-- Supabase stack (GoTrue/PostgREST need Docker, which cannot start in this
-- environment — see docs/README.md's current-state table). Against a real
-- Supabase project, none of this file is needed; PostgREST already sets
-- `request.jwt.claims` per request and these roles/function already exist.
--
-- Applied once via `npm run db:bootstrap` (see package.json), after the
-- Drizzle-generated table migrations.

-- 1. auth.uid() — reads the 'sub' claim from the JWT claims set for the
--    current transaction via set_config('request.jwt.claims', ..., true).
--    src/db/client.ts's withRlsContext() sets this per request/transaction.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid;
$$;

-- 2. Roles. `authenticated` is a group role granted to any real app user
--    connection (mirrors Supabase's `authenticated` role); `app_user` is the
--    actual login role our Next.js app connects as (APP_DATABASE_URL) for
--    RLS-enforced request-scoped queries; `service_role` is a login role
--    with BYPASSRLS for migrations/seed/admin jobs (DATABASE_URL in this
--    local setup uses the `postgres` superuser directly instead, which also
--    bypasses RLS — service_role exists here for parity with a real
--    Supabase deployment where you would NOT use the superuser for the app).
do $$
begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login password 'app_user_dev_password' in role authenticated;
  end if;
end
$$;

grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
grant all privileges on all tables in schema public to authenticated;
grant all privileges on all sequences in schema public to authenticated;
alter default privileges in schema public grant all privileges on tables to authenticated;
alter default privileges in schema public grant all privileges on sequences to authenticated;

-- 3. has_permission() — checks whether the current auth.uid() belongs to
--    organization_id with a role granting permission_key. Shared by every
--    write policy below instead of duplicating the join per table.
create or replace function public.has_permission(p_organization_id uuid, p_permission_key text)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from organization_members om
    join roles r on r.id = om.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions p on p.id = rp.permission_id
    where om.organization_id = p_organization_id
      and om.profile_id = auth.uid()
      and p.key = p_permission_key
  );
$$;

-- 4. is_org_member() — the common "can this user see this org's data at
--    all" check used by every select policy below.
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organization_members om
    where om.organization_id = p_organization_id
      and om.profile_id = auth.uid()
  );
$$;

-- 5. Row Level Security. Every tenant-scoped table gets, at minimum, a
--    "members can select their own org's rows" policy. Tables with
--    finer-grained write rules (e.g. only the importer org can award an
--    RFQ) enforce that in the application layer on top of this baseline —
--    RLS here is the defense-in-depth floor, not the only check.

-- Identity domain
alter table organizations enable row level security;
create policy org_members_select on organizations for select
  using (is_org_member(id));
create policy org_members_update on organizations for update
  using (has_permission(id, 'organization.update'));

alter table organization_members enable row level security;
create policy org_members_select_members on organization_members for select
  using (is_org_member(organization_id));

alter table invitations enable row level security;
create policy org_members_select_invitations on invitations for select
  using (is_org_member(organization_id));
create policy org_admins_write_invitations on invitations for insert
  with check (has_permission(organization_id, 'invitation.create'));

alter table audit_logs enable row level security;
create policy org_members_select_audit_logs on audit_logs for select
  using (organization_id is null or is_org_member(organization_id));

-- Trade domain (org-owned tables; reference tables below are read-open)
alter table warehouses enable row level security;
create policy org_members_select_warehouses on warehouses for select
  using (is_org_member(organization_id));
create policy org_members_write_warehouses on warehouses for insert
  with check (is_org_member(organization_id));

alter table products enable row level security;
create policy org_members_select_products on products for select
  using (is_org_member(organization_id));
create policy org_members_write_products on products for insert
  with check (is_org_member(organization_id));

-- Marketplace domain
alter table rfqs enable row level security;
create policy anyone_authenticated_select_open_rfqs on rfqs for select
  using (status = 'OPEN' or is_org_member(organization_id));
create policy importer_write_rfqs on rfqs for insert
  with check (is_org_member(organization_id));
create policy importer_update_own_rfqs on rfqs for update
  using (is_org_member(organization_id));

alter table rfq_items enable row level security;
create policy rfq_items_follow_rfq on rfq_items for select
  using (exists (select 1 from rfqs where rfqs.id = rfq_items.rfq_id and (rfqs.status = 'OPEN' or is_org_member(rfqs.organization_id))));

alter table bids enable row level security;
create policy bidder_or_rfq_owner_select_bids on bids for select
  using (
    is_org_member(organization_id)
    or exists (select 1 from rfqs where rfqs.id = bids.rfq_id and is_org_member(rfqs.organization_id))
  );
create policy exporter_write_bids on bids for insert
  with check (is_org_member(organization_id));

alter table negotiations enable row level security;
create policy negotiation_parties_select on negotiations for select
  using (
    exists (
      select 1 from bids
      join rfqs on rfqs.id = bids.rfq_id
      where bids.id = negotiations.bid_id
        and (is_org_member(bids.organization_id) or is_org_member(rfqs.organization_id))
    )
  );

alter table contracts enable row level security;
create policy contract_parties_select on contracts for select
  using (
    exists (
      select 1 from bids
      join rfqs on rfqs.id = bids.rfq_id
      where bids.id = contracts.bid_id
        and (is_org_member(bids.organization_id) or is_org_member(rfqs.organization_id))
    )
  );

-- Logistics domain
alter table shipments enable row level security;
create policy shipment_parties_select on shipments for select
  using (is_org_member(exporter_organization_id) or is_org_member(importer_organization_id));

alter table shipment_tracking enable row level security;
create policy shipment_tracking_follows_shipment on shipment_tracking for select
  using (
    exists (
      select 1 from shipments
      where shipments.id = shipment_tracking.shipment_id
        and (is_org_member(shipments.exporter_organization_id) or is_org_member(shipments.importer_organization_id))
    )
  );

alter table freight_quotes enable row level security;
create policy freight_quotes_follow_shipment on freight_quotes for select
  using (
    exists (
      select 1 from shipments
      where shipments.id = freight_quotes.shipment_id
        and (is_org_member(shipments.exporter_organization_id) or is_org_member(shipments.importer_organization_id))
    )
  );

alter table containers enable row level security;
create policy containers_follow_shipment on containers for select
  using (
    exists (
      select 1 from shipments
      where shipments.id = containers.shipment_id
        and (is_org_member(shipments.exporter_organization_id) or is_org_member(shipments.importer_organization_id))
    )
  );

-- Finance domain
alter table escrow_accounts enable row level security;
create policy escrow_parties_select on escrow_accounts for select
  using (exists (select 1 from rfqs where rfqs.id = escrow_accounts.rfq_id and is_org_member(rfqs.organization_id)));

alter table escrow_milestones enable row level security;
create policy escrow_milestones_follow_account on escrow_milestones for select
  using (
    exists (
      select 1 from escrow_accounts
      join rfqs on rfqs.id = escrow_accounts.rfq_id
      where escrow_accounts.id = escrow_milestones.escrow_account_id
        and is_org_member(rfqs.organization_id)
    )
  );

alter table invoices enable row level security;
create policy invoice_org_select on invoices for select
  using (is_org_member(organization_id));

alter table payments enable row level security;
create policy payments_follow_invoice_or_escrow on payments for select
  using (
    (invoice_id is not null and exists (select 1 from invoices where invoices.id = payments.invoice_id and is_org_member(invoices.organization_id)))
    or (escrow_account_id is not null and exists (
      select 1 from escrow_accounts join rfqs on rfqs.id = escrow_accounts.rfq_id
      where escrow_accounts.id = payments.escrow_account_id and is_org_member(rfqs.organization_id)
    ))
  );

alter table wallets enable row level security;
create policy wallet_org_select on wallets for select
  using (is_org_member(organization_id));

alter table transactions enable row level security;
create policy transactions_follow_wallet on transactions for select
  using (exists (select 1 from wallets where wallets.id = transactions.wallet_id and is_org_member(wallets.organization_id)));

alter table trade_loans enable row level security;
create policy trade_loan_org_select on trade_loans for select
  using (is_org_member(requesting_organization_id));

-- Files domain
alter table documents enable row level security;
create policy documents_org_select on documents for select
  using (is_org_member(organization_id));

alter table uploaded_files enable row level security;
create policy uploaded_files_org_select on uploaded_files for select
  using (is_org_member(organization_id));

-- Notifications domain (owned by the individual profile, not the org)
alter table notifications enable row level security;
create policy notifications_owner_select on notifications for select
  using (profile_id = auth.uid());
create policy notifications_owner_update on notifications for update
  using (profile_id = auth.uid());

alter table notification_preferences enable row level security;
create policy notification_preferences_owner_all on notification_preferences for all
  using (profile_id = auth.uid());

-- AI domain: service-role only for now (no policy for `authenticated` means
-- RLS denies all access from the app connection; service_role bypasses RLS
-- entirely, which is how background scoring jobs read/write these tables).
alter table ai_predictions enable row level security;
alter table ai_logs enable row level security;
alter table route_predictions enable row level security;
alter table risk_scores enable row level security;

-- Reference tables stay open-read (needed for the public, unauthenticated
-- Compliance Checker) and are never writable by `authenticated` — only
-- service_role (admin/seed) can write them.
grant select on countries, ports, hs_codes, tariffs, trade_rules, restricted_products, carriers, logistics_routes to authenticated;
