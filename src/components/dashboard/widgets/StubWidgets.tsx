// Calendar and Tasks widgets are placeholders — there is no calendar/task
// domain in the schema yet (no `calendar_events` or `tasks` tables), so
// these intentionally render a "coming soon" state rather than fabricate
// data. Wire these up to real tables/sources when that domain exists.
export function CalendarWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Calendar</h2>
      <p className="mt-2 text-sm text-ink-400">Coming soon — shipment and payment deadlines will appear here.</p>
    </div>
  );
}

export function TasksWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Tasks</h2>
      <p className="mt-2 text-sm text-ink-400">Coming soon — action items (KYC follow-ups, pending bids) will appear here.</p>
    </div>
  );
}

// Ecosystem-role stubs below (freight forwarders, customs brokers,
// warehouse providers, insurance providers, finance partners/investors —
// see src/db/schema/identity.ts's organizationTypeEnum). None of these
// have an owning domain table/column yet: `shipments` has no
// forwarder-assignment column, and there is no customs-queue/inventory/
// policy table, nor an "open/unassigned" funding-request concept on
// `trade_loans` an investor could browse (see src/db/schema/logistics.ts
// and finance.ts). Honest "coming soon" placeholders, no fabricated data.
export function ShipmentsStubWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Shipments</h2>
      <p className="mt-2 text-sm text-ink-400">
        Coming soon — a forwarder-scoped shipments view needs a forwarder-assignment column on shipments, which does not
        exist yet.
      </p>
    </div>
  );
}

export function CustomsQueueWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Customs Queue</h2>
      <p className="mt-2 text-sm text-ink-400">Coming soon — customs clearance work items will appear here.</p>
    </div>
  );
}

export function InventoryWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Inventory</h2>
      <p className="mt-2 text-sm text-ink-400">Coming soon — warehouse inventory levels will appear here.</p>
    </div>
  );
}

export function PoliciesWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Policies</h2>
      <p className="mt-2 text-sm text-ink-400">Coming soon — cargo/trade insurance policies will appear here.</p>
    </div>
  );
}

export function FundingOpportunitiesWidget() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Funding Opportunities</h2>
      <p className="mt-2 text-sm text-ink-400">
        Coming soon — open trade-finance funding requests will appear here once trade_loans supports an
        unassigned/investable state.
      </p>
    </div>
  );
}
