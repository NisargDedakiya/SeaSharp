// Calendar and Tasks widgets are placeholders — there is no calendar/task
// domain in the schema yet (no `calendar_events` or `tasks` tables), so
// these intentionally render a "coming soon" state rather than fabricate
// data. Wire these up to real tables/sources when that domain exists.
export function CalendarWidget() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">Calendar</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon — shipment and payment deadlines will appear here.</p>
    </div>
  );
}

export function TasksWidget() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">Tasks</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon — action items (KYC follow-ups, pending bids) will appear here.</p>
    </div>
  );
}
