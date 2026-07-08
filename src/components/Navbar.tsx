"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { SessionUser } from "@/core/identity/session";
import { SearchPalette } from "@/components/SearchPalette";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group relative py-1 text-slate-300 transition-colors hover:text-sky-400">
      {children}
      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-sky-400 transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </Link>
  );
}

export function Navbar({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <motion.span
            className="relative flex h-9 w-9 shrink-0 items-center justify-center"
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <Image src="/logo-mark.png" alt="SeaSharp" fill sizes="36px" className="object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]" priority />
          </motion.span>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-slate-50">Sea</span>
            <span className="bg-gradient-to-r from-sky-400 to-sky-300 bg-clip-text text-transparent">Sharp</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <NavLink href="/compliance-checker">Compliance Checker</NavLink>
          <NavLink href="/marketplace">RFQ Marketplace</NavLink>
          {user && <NavLink href="/dashboard">Dashboard</NavLink>}
        </div>

        <div className="flex items-center gap-3">
          <SearchPalette />
          {user ? (
            <>
              <span className="hidden text-sm text-slate-400 sm:inline">{user.fullName}</span>
              <button
                onClick={handleSignOut}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-sky-500/60 hover:text-sky-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm text-slate-200 transition-colors hover:text-sky-400"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-gradient-to-r from-sky-500 to-sky-400 px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
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
