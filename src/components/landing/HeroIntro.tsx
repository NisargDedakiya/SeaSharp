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
          className="object-contain drop-shadow-[0_0_35px_rgba(184,144,47,0.35)]"
          priority
        />
      </motion.div>

      <motion.p variants={item} className="text-sm font-semibold uppercase tracking-widest text-gold-600">
        One Platform. Every Trade. Anywhere in the World.
      </motion.p>
      <motion.h1 variants={item} className="mt-4 text-4xl font-bold tracking-tight text-ink-900 sm:text-6xl">
        The Global Trade Infrastructure Platform
      </motion.h1>
      <motion.p variants={item} className="mx-auto mt-6 max-w-2xl text-lg text-ink-500">
        SeaSharp unifies trade intelligence, compliance, documentation, logistics, finance,
        supplier verification, and shipment management into one ecosystem — from supplier
        discovery to warehouse delivery.
      </motion.p>
      <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/compliance-checker"
          className="rounded-md bg-ink-900 px-6 py-3 text-sm font-semibold text-cream-50 shadow-premium-lg transition-transform duration-200 hover:bg-ink-800 hover:scale-[1.03] active:scale-[0.98]"
        >
          Try the Free Compliance Checker
        </Link>
        <Link
          href="/marketplace"
          className="rounded-md border border-ink-100 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-500/60 hover:text-gold-600"
        >
          Browse RFQ Marketplace
        </Link>
      </motion.div>
    </motion.div>
  );
}
