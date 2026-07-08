"use client";

import { useState, type ReactNode } from "react";
import type { WidgetGridSpan, WidgetLayoutItem, WidgetType } from "./widgets/registry";

type RenderedWidget = {
  id: string;
  type: WidgetType;
  title: string;
  gridSpan: WidgetGridSpan;
  node: ReactNode;
};

const SPAN_CLASS: Record<WidgetGridSpan, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
};

// Client-side show/hide + reorder for the dashboard's widgets, persisted
// via PATCH /api/dashboard/layout (src/app/api/dashboard/layout/route.ts).
// All widgets' content is pre-rendered server-side (dashboard/page.tsx
// renders every widget's ReactNode up front, visible or not) so toggling
// visibility/order here never needs a refetch — this component only ever
// reorders/shows/hides the `widgets` array and PATCHes the resulting
// layout in the background.
export function DashboardGrid({ initialLayout, widgets }: { initialLayout: WidgetLayoutItem[]; widgets: RenderedWidget[] }) {
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(initialLayout);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const widgetById = new Map(widgets.map((w) => [w.id, w]));
  const ordered = [...layout].sort((a, b) => a.order - b.order);

  async function persist(next: WidgetLayoutItem[]) {
    setLayout(next);
    setSaving(true);
    try {
      await fetch("/api/dashboard/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleVisible(id: string) {
    persist(layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  function move(id: string, direction: -1 | 1) {
    const currentOrder = [...layout].sort((a, b) => a.order - b.order);
    const index = currentOrder.findIndex((w) => w.id === id);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const swapped = [...currentOrder];
    [swapped[index], swapped[targetIndex]] = [swapped[targetIndex], swapped[index]];
    persist(swapped.map((w, i) => ({ ...w, order: i })));
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const currentOrder = [...layout].sort((a, b) => a.order - b.order);
    const from = currentOrder.findIndex((w) => w.id === dragId);
    const to = currentOrder.findIndex((w) => w.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...currentOrder];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    persist(reordered.map((w, i) => ({ ...w, order: i })));
    setDragId(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-3">
        {saving && <span className="text-xs text-slate-500">Saving...</span>}
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
        >
          {editing ? "Done" : "Customize widgets"}
        </button>
      </div>

      {editing && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-2 text-xs text-slate-500">Show/hide and reorder widgets. Drag to reorder.</p>
          <ul className="space-y-1">
            {ordered.map((item, index) => (
              <li key={item.id} className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-slate-800/50">
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={item.visible} onChange={() => toggleVisible(item.id)} />
                  {widgetById.get(item.id)?.title ?? item.type}
                </label>
                <span className="flex gap-1">
                  <button
                    disabled={index === 0}
                    onClick={() => move(item.id, -1)}
                    className="rounded px-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    disabled={index === ordered.length - 1}
                    onClick={() => move(item.id, 1)}
                    className="rounded px-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {ordered
          .filter((item) => item.visible)
          .map((item) => {
            const widget = widgetById.get(item.id);
            if (!widget) return null;
            return (
              <div
                key={item.id}
                draggable={editing}
                onDragStart={() => setDragId(item.id)}
                onDragOver={(e) => editing && e.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className={`${SPAN_CLASS[widget.gridSpan]} ${
                  editing ? "cursor-move rounded-xl ring-1 ring-slate-700" : ""
                }`}
              >
                {widget.node}
              </div>
            );
          })}
      </div>
    </div>
  );
}
