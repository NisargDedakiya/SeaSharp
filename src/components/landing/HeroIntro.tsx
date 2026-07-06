"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function HeroIntro() {
  return (
    <motion.div initial="hidden" animate="show" variants={container} className="mx-auto max-w-5xl text-center">
      <motion.div variants={item} className="animate-bob relative mx-auto mb-6 h-24 w-24">
        <Image
          src="/logo-mark.png"
          alt="SeaSharp"
          fill
          sizes="96px"
          className="object-contain drop-shadow-[0_0_35px_rgba(56,189,248,0.45)]"
          priority
        />
      </motion.div>

      <motion.p variants={item} className="text-sm font-semibold uppercase tracking-widest text-sky-400">
        One Platform. Every Trade. Anywhere in the World.
      </motion.p>
      <motion.h1 variants={item} className="mt-4 text-4xl font-bold tracking-tight text-slate-50 sm:text-6xl">
        The Global Trade Infrastructure Platform
      </motion.h1>
      <motion.p variants={item} className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
        SeaSharp unifies trade intelligence, compliance, documentation, logistics, finance,
        supplier verification, and shipment management into one ecosystem — from supplier
        discovery to warehouse delivery.
      </motion.p>
      <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/compliance-checker"
          className="rounded-md bg-gradient-to-r from-sky-500 to-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_30px_-6px_rgba(56,189,248,0.6)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
        >
          Try the Free Compliance Checker
        </Link>
        <Link
          href="/marketplace"
          className="rounded-md border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-sky-500/60 hover:text-sky-300"
        >
          Browse RFQ Marketplace
        </Link>
      </motion.div>
    </motion.div>
  );
}
