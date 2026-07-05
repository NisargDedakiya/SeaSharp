"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-sm font-bold text-slate-950">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-50">TradeNova</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <Link href="/compliance-checker" className="hover:text-emerald-400">
            Compliance Checker
          </Link>
          <Link href="/marketplace" className="hover:text-emerald-400">
            RFQ Marketplace
          </Link>
          {session && (
            <Link href="/dashboard" className="hover:text-emerald-400">
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {status === "loading" ? null : session ? (
            <>
              <span className="hidden text-sm text-slate-400 sm:inline">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm text-slate-200 hover:text-emerald-400"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
