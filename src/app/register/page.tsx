"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EXPORTER",
    companyName: "",
    country: "IN",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Registration failed.");
        return;
      }

      // /api/auth/register sets the session cookie directly on success —
      // no separate sign-in round trip needed.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold text-ink-900">Create your account</h1>
      <p className="mt-2 text-ink-500">Join as a verified exporter, importer, or investor.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex gap-2">
          {(["EXPORTER", "IMPORTER", "INVESTOR"] as const).map((role) => (
            <button
              type="button"
              key={role}
              onClick={() => setForm((f) => ({ ...f, role }))}
              className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
                form.role === role
                  ? "border-gold-500 bg-gold-500/10 text-gold-600"
                  : "border-ink-100 text-ink-700"
              }`}
            >
              {role === "EXPORTER" ? "Exporter" : role === "IMPORTER" ? "Importer" : "Investor"}
            </button>
          ))}
        </div>

        <input
          required
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        <input
          placeholder="Company name"
          value={form.companyName}
          onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        <select
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        >
          <option value="IN">India</option>
          <option value="AE">United Arab Emirates</option>
          <option value="US">United States</option>
          <option value="DE">Germany</option>
          <option value="CN">China</option>
        </select>

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-ink-900 px-6 py-2.5 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </main>
  );
}
