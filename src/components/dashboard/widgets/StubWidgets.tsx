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
