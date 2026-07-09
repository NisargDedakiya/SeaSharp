"use client";

import { useEffect, useState } from "react";

type AuditEntityType = "rfq" | "shipment";

type TimelineEntry = {
  timestamp: string;
  actor: { profileId: string | null; name: string | null };
  type: string;
  description: string;
  payload: Record<string, unknown> | null;
};

// Standalone audit-trail widget: fetches GET /api/audit/[entityType]/[entityId]
// (src/app/api/audit/[entityType]/[entityId]/route.ts) and renders the
// merged domain_events + workflow_history timeline for one RFQ/shipment.
// Not wired into dashboard/page.tsx yet — Task 5 consumes this directly as
// a dashboard widget, so it's kept self-contained: pass it an entity and it
// fetches/renders on its own, same client-fetch-on-mount shape as
// KycPanel/LoanPanel use for their POST actions.
export function AuditTimelineWidget({
  entityType,
  entityId,
}: {
  entityType: AuditEntityType;
  entityId: string;
}) {
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/audit/${entityType}/${entityId}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load audit timeline.");
          return;
        }
        setTimeline(data.timeline);
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Audit Timeline</h2>

      {loading && <p className="mt-2 text-sm text-ink-400">Loading timeline...</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!loading && !error && timeline && timeline.length === 0 && (
        <p className="mt-2 text-sm text-ink-400">No activity recorded yet.</p>
      )}

      {!loading && !error && timeline && timeline.length > 0 && (
        <ol className="mt-4 space-y-3 border-l border-ink-100 pl-4">
          {timeline.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`} className="text-sm">
              <p className="text-ink-900">{entry.description}</p>
              <p className="text-xs text-ink-400">
                {new Date(entry.timestamp).toLocaleString()}
                {entry.actor.name ? ` · ${entry.actor.name}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
