-- RLS for deals + funding_requests (importer deal confirmation and
-- investor-directed financing). Same posture as the other domain tables:
-- every read/write today goes through serviceDb in src/core/trade/deals.ts
-- and src/core/finance/funding.ts, so these policies are the
-- defense-in-depth backstop for eventual APP_DATABASE_URL reads, not the
-- primary access control (which lives in those modules' actor checks).

-- Deals: visible to members of either trade party.
alter table deals enable row level security;
create policy deal_parties_select_deals on deals for select
  using (is_org_member(importer_organization_id) or is_org_member(exporter_organization_id));

-- Funding requests: visible to the requesting exporter's members and the
-- funder's members once funded. OPEN requests are additionally readable by
-- any authenticated user — that is the product surface: an open ask is a
-- marketplace listing investors browse (Funding Opportunities widget),
-- mirroring how OPEN rfqs are browsable marketplace-wide.
alter table funding_requests enable row level security;
create policy funding_parties_select_funding_requests on funding_requests for select
  using (
    is_org_member(exporter_organization_id)
    or (funder_organization_id is not null and is_org_member(funder_organization_id))
    or (status = 'OPEN' and auth.uid() is not null)
  );
