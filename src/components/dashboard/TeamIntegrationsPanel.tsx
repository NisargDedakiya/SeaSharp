"use client";

import { useEffect, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type WebhookEndpoint = {
  id: string;
  url: string;
  eventTypes: string[];
  createdAt: string;
  revokedAt: string | null;
};

// Owner/Admin-only panel (see /dashboard/page.tsx's role check against the
// seeded role names in drizzle/manual/02_seed_system_roles.sql). Reuses the
// existing session-cookie-authed API-key/webhook-endpoint routes
// (src/app/api/api-keys, src/app/api/webhook-endpoints) rather than adding
// new ones — this is just a UI for CRUD that already existed with no
// frontend.
export function TeamIntegrationsPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [keysRes, endpointsRes] = await Promise.all([fetch("/api/api-keys"), fetch("/api/webhook-endpoints")]);
    setKeys(keysRes.ok ? await keysRes.json() : []);
    setEndpoints(endpointsRes.ok ? await endpointsRes.json() : []);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function createKey() {
    setBusy(true);
    setError(null);
    setNewKeyPlaintext(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Key ${new Date().toLocaleDateString()}`, scopes: [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create API key.");
        return;
      }
      setNewKeyPlaintext(data.key);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createWebhook() {
    const url = window.prompt("Webhook URL (https://...)");
    if (!url) return;
    setBusy(true);
    setError(null);
    setNewWebhookSecret(null);
    try {
      const res = await fetch("/api/webhook-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventTypes: ["*"] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create webhook endpoint.");
        return;
      }
      setNewWebhookSecret(data.secret);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revokeWebhook(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/webhook-endpoints/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Team &amp; Integrations</h2>
      <p className="mt-1 text-xs text-ink-400">Visible to Owner and Admin roles only.</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-ink-400">Loading...</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-700">API Keys</h3>
              <button
                onClick={createKey}
                disabled={busy}
                className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                New key
              </button>
            </div>
            {newKeyPlaintext && (
              <p className="mt-2 break-all rounded-md bg-cream-100 p-2 text-xs text-ink-900">
                Copy this now — it will not be shown again: <span className="font-mono">{newKeyPlaintext}</span>
              </p>
            )}
            {keys.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No API keys yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between text-sm text-ink-700">
                    <span>
                      {k.name} <span className="text-ink-400">({k.keyPrefix}...)</span>
                      {k.revokedAt && <span className="ml-1 text-xs text-red-600">revoked</span>}
                    </span>
                    {!k.revokedAt && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        disabled={busy}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-700">Webhook Endpoints</h3>
              <button
                onClick={createWebhook}
                disabled={busy}
                className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                New endpoint
              </button>
            </div>
            {newWebhookSecret && (
              <p className="mt-2 break-all rounded-md bg-cream-100 p-2 text-xs text-ink-900">
                Signing secret — copy this now: <span className="font-mono">{newWebhookSecret}</span>
              </p>
            )}
            {endpoints.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No webhook endpoints yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {endpoints.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm text-ink-700">
                    <span className="truncate">
                      {e.url}
                      {e.revokedAt && <span className="ml-1 text-xs text-red-600">revoked</span>}
                    </span>
                    {!e.revokedAt && (
                      <button
                        onClick={() => revokeWebhook(e.id)}
                        disabled={busy}
                        className="ml-2 shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
