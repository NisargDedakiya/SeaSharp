import "server-only";
import type { CurrentOrganization } from "@/core/identity/session";
import { listDealsForOrganization } from "@/core/trade/deals";
import { DealsPanel, type DealPanelItem } from "@/components/dashboard/DealsPanel";

// Confirmed deals for the signed-in org (either side of the trade). The
// exporter view is the actionable one: each CONFIRMED deal without an
// active funding request offers the "request loan / funds from investors"
// flow (see DealsPanel).
export async function DealsWidget({ organization }: { organization: CurrentOrganization }) {
  const deals = await listDealsForOrganization(organization.id);

  const items: DealPanelItem[] = deals.map((deal) => ({
    id: deal.id,
    rfqId: deal.rfqId,
    product: deal.product,
    totalValue: deal.totalValue,
    currency: deal.currency,
    status: deal.status,
    confirmedAt: deal.confirmedAt,
    counterpartyName:
      deal.exporter.id === organization.id ? deal.importer.name : deal.exporter.name,
    fundingRequest: deal.fundingRequest,
  }));

  return <DealsPanel deals={items} canRequestFunding={organization.type === "EXPORTER"} />;
}
