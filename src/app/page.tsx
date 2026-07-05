import Link from "next/link";
import { StatTile } from "@/components/landing/StatTile";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { PillarCard } from "@/components/landing/PillarCard";

const PAIN_POINTS = [
  { title: "No Trade Intelligence", body: "Exporters Google HS codes. Consultants charge per inquiry." },
  { title: "Manual Documentation", body: "Commercial invoices and packing lists filled by hand. Errors cause customs delays." },
  { title: "No Buyer Discovery", body: "APMC merchants rely on middlemen and cold calls to find international buyers." },
  { title: "Opaque Pricing", body: "Freight costs discovered after the fact. Hidden fees erode margins unpredictably." },
  { title: "Fragmented Logistics", body: "Warehouse → port → customs → delivery managed by different vendors with zero unified visibility." },
  { title: "Working Capital Crunch", body: "Exporters win large orders but can't fulfill them. Banks routinely reject SME trade loans." },
  { title: "Zero Supply Chain Security", body: "Supplier fraud, fake documentation, and phishing attacks cost billions annually." },
];

const AI_MODULES = [
  { name: "BidSense", tag: "AI Bid Price Prediction", body: "Predicts the optimal bid price from historical RFQ data — winning bids, product category, season, volume." },
  { name: "SupplierRadar", tag: "OSINT-Powered Supplier Vetting", body: "Continuously monitors registered exporters using public data. Flags anomalies before KYC even begins." },
  { name: "DocAI", tag: "Smart Document Parsing", body: "Extracts and auto-populates structured fields from any trade document, reducing error rates ~90%." },
  { name: "RouteIQ", tag: "Freight Route Optimization", body: "Predicts the optimal freight route — carrier, port pair, timing, cost — from historical shipment data." },
  { name: "CreditLayer", tag: "PO Loan Risk Scoring", body: "Scores financing requests using TNS, delivery history, and commodity volatility to set investor rates." },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            RFQ Marketplace · Compliance Intelligence · Logistics · Trade Finance
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-50 sm:text-6xl">
            The Trade Operating System
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Global trade is fragmented across 7+ disconnected tools. TradeNova combines trade
            intelligence, compliance automation, reverse-auction procurement, end-to-end
            logistics, and PO-backed financing into one closed-loop platform.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/compliance-checker"
              className="rounded-md bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Try the Free Compliance Checker
            </Link>
            <Link
              href="/marketplace"
              className="rounded-md border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Browse RFQ Marketplace
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile value="$32T" label="Global Trade / Year" />
          <StatTile value="80%" label="Still Managed via Email" />
          <StatTile value="500M+" label="SME Exporters Worldwide" />
          <StatTile value="$1.5T" label="SME Trade Finance Gap" />
        </div>
      </section>

      {/* Problem */}
      <section className="px-6 py-24">
        <SectionHeading
          eyebrow="The Problem"
          title="Seven Broken Systems, Zero Unified Solution"
          subtitle="Every exporter stitches together 7+ tools to complete a single trade. Each handoff is a failure point."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-slate-100">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core architecture — four pillars */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <SectionHeading
          eyebrow="Core Architecture"
          title="Four Pillars. One Closed Loop."
          subtitle="Each pillar creates value on its own. Together they form a network effect engine."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2">
          <PillarCard
            letter="A"
            title="Intelligence Layer"
            description="Trade Route Engine & Compliance Automation — instant HS code, tariff, documents, and landed cost."
            points={[
              "HS Code Lookup & Tariff Calculator",
              "Document Checklist & Compliance Steps",
              "Country Trade Intelligence (5 zones at launch)",
              "Landed Cost Calculator",
            ]}
          />
          <PillarCard
            letter="B"
            title="Marketplace Layer"
            description="Reverse-Auction RFQ with Escrow — blind bidding protects pricing integrity, funds release at verified milestones."
            points={[
              "Blind Bidding",
              "Escrow Milestone Release",
              "KYC/KYB Verified Exporters",
              "TradeNova Score (TNS) placement",
            ]}
          />
          <PillarCard
            letter="C"
            title="Logistics Layer"
            description="End-to-End Digital Freight Forwarding from exporter warehouse to importer godown."
            points={[
              "Pickup → port / airport",
              "Sea / Air freight with port handling",
              "Customs clearance automation",
              "Delivery with milestone tracking",
            ]}
          />
          <PillarCard
            letter="D"
            title="Finance Layer"
            description="PO-Backed Trade Finance Marketplace — risk-calibrated working capital no bank offers SME exporters."
            points={[
              "PO Financing on verified purchase orders",
              "Institutional & private credit investors",
              "Automatic repayment via escrow routing",
              "TNS-gated interest rates",
            ]}
          />
        </div>
      </section>

      {/* AI modules */}
      <section className="px-6 py-24">
        <SectionHeading
          eyebrow="AI Intelligence Layer"
          title="Five AI Modules That Make TradeNova Self-Improving"
          subtitle="Every transaction trains the models. Every model makes the next transaction cheaper, faster, and safer."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_MODULES.map((m) => (
            <div key={m.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-emerald-400">{m.name}</h3>
              <p className="text-xs uppercase tracking-wide text-slate-500">{m.tag}</p>
              <p className="mt-2 text-sm text-slate-400">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TNS */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <SectionHeading
          eyebrow="New Feature Concept"
          title="TradeNova Score (TNS) — The Credit Score for Trade"
          subtitle="A composite 0–1000 score for every exporter. Determines bid visibility, PO loan eligibility, and interest rate bands."
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-4">
          <StatTile value="0–400" label="New" />
          <StatTile value="401–650" label="Verified" />
          <StatTile value="651–800" label="Reliable" />
          <StatTile value="801–1000" label="Trusted Partner" />
        </div>
      </section>

      {/* Unit economics */}
      <section className="px-6 py-24">
        <SectionHeading
          eyebrow="Unit Economics"
          title="Three Revenue Streams, One Transaction"
          subtitle="A single average trade transaction generates revenue from escrow, logistics, and finance simultaneously."
        />
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile value="$25K" label="Avg. Deal Size" />
          <StatTile value="$500" label="Escrow Fee (2%)" />
          <StatTile value="$360" label="Logistics Margin (12%)" />
          <StatTile value="$120" label="Finance Yield (0.5%)" />
        </div>
        <div className="mx-auto mt-4 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile value="$980" label="Revenue / Transaction" />
          <StatTile value="500" label="Deals / Month (Yr 2)" />
          <StatTile value="$490K" label="MRR Target (Yr 2)" />
          <StatTile value="~$6M" label="ARR Run Rate" />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-slate-50">Start narrow. Win deep. Then expand.</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Phase 1 starts with one corridor: India → UAE agricultural exports.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-md bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Join as Exporter or Importer
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-10 text-center text-sm text-slate-500">
        TradeNova — The Trade Operating System · Founder: Nisarg Dedakiya
      </footer>
    </main>
  );
}
