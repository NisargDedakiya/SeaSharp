import "server-only";
import { eq, desc } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { notifications } from "@/db/schema";

// Real data: the same `notifications` table src/core/notifications/service.ts
// (the single write path for notifications) inserts into for IN_APP
// deliveries — read-only here, nothing new gets written by this widget.
export async function NotificationsWidget({ profileId }: { profileId: string }) {
  const recent = await serviceDb.query.notifications.findMany({
    where: eq(notifications.profileId, profileId),
    orderBy: [desc(notifications.createdAt)],
    limit: 8,
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-semibold text-slate-100">Notifications</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No notifications yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent.map((n) => (
            <li key={n.id} className="text-sm">
              <p className={n.readAt ? "text-slate-400" : "text-slate-100"}>{n.type}</p>
              <p className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
