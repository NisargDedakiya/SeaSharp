"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid email or password.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold text-ink-900">Sign in</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-ink-100 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
        />
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-ink-900 px-6 py-2.5 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-500">
        No account?{" "}
        <a href="/register" className="text-gold-600 hover:underline">
          Register
        </a>
      </p>
    </main>
  );
}
