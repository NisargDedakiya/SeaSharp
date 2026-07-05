import Link from "next/link";
import { StatTile } from "@/components/landing/StatTile";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { PillarCard } from "@/components/landing/PillarCard";

const ECOSYSTEM = [
  { role: "Exporters", body: "Find buyers, create quotations, generate documents, manage shipments, receive payments, apply for trade finance.", live: true },
  { role: "Importers", body: "Discover suppliers, compare quotations, track shipments, manage imports, handle customs documentation.", live: true },
  { role: "Freight Forwarders", body: "Receive shipment requests, submit transport quotations, manage containers, update shipment milestones.", live: false },
  { role: "Customs Brokers", body: "Review documentation, upload customs status, handle compliance.", live: false },
  { role: "Warehouse Providers", body: "Manage pickup, confirm storage, schedule dispatch.", live: false },
  { role: "Banks & Financial Institutions", body: "Offer trade finance, manage escrow, verify transactions.", live: false },
  { role: "Insurance Companies", body: "Offer cargo insurance, manage claims, verify shipment value.", live: false },
  { role: "Government & Regulatory Authorities", body: "Digital verification, compliance validation, digital customs integration.", live: false },
];

const AI_MODULES = [
  { name: "BidSense", tag: "AI Bid Price Prediction", body: "Predicts the optimal bid price from historical RFQ data — winning bids, product category, season, volume." },
  { name: "SupplierRadar", tag: "OSINT-Powered Supplier Vetting", body: "Continuously monitors registered exporters using public data. Flags anomalies before KYC even begins." },
  { name: "DocAI", tag: "Smart Document Parsing", body: "Extracts and auto-populates structured fields from any trade document, reducing error rates ~90%." },
  { name: "RouteIQ", tag: "Freight Route Optimization", body: "Predicts the optimal freight route — carrier, port pair, timing, cost — from historical shipment data." },
  { name: "CreditLayer", tag: "PO Loan Risk Scoring", body: "Scores financing requests using STS, delivery history, and commodity volatility to set investor rates." },
];

const AI_MODULES_ROADMAP = [
  { name: "RiskAI", body: "Standalone fraud detection across bid patterns, logins, and document submissions." },
  { name: "PriceAI", body: "Freight price prediction across carriers and seasons." },
  { name: "MarketAI", body: "Buyer recommendations and demand-side matching." },
];

const REVENUE_STREAMS = [
  "SaaS subscriptions",
  "Logistics commissions",
  "Escrow processing fees",
  "Trade finance commissions",
  "Insurance partnerships",
  "Verification services",
  "Enterprise API subscriptions",
  "Premium analytics",
];

const ROADMAP = [
  {
    phase: "Phase 1",
    title: "Foundation",
    items: ["Trade Intelligence", "Documentation", "Basic Logistics", "Dashboard", "Authentication"],
    status: "Live" as const,
  },
  {
    phase: "Phase 2",
    title: "Marketplace",
    items: ["RFQ Marketplace", "Escrow", "Shipment Tracking", "Partner Integrations"],
    status: "Live" as const,
  },
  {
    phase: "Phase 3",
    title: "Finance & Intelligence",
    items: ["Trade Finance", "AI Automation", "Fraud Detection", "API Platform", "Enterprise Features"],
    status: "Roadmap" as const,
  },
  {
    phase: "Phase 4",
    title: "Infrastructure",
    items: ["Global Expansion", "Government Integrations", "ERP Integrations", "Supply Chain Intelligence", "Open Developer Platform"],
    status: "Roadmap" as const,
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            One Platform. Every Trade. Anywhere in the World.
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-50 sm:text-6xl">
            The Global Trade Infrastructure Platform
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            SeaSharp unifies trade intelligence, compliance, documentation, logistics, finance,
            supplier verification, and shipment management into one ecosystem — from supplier
            discovery to warehouse delivery.
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

      {/* Trade Ecosystem */}
      <section className="px-6 py-24">
        <SectionHeading
          eyebrow="Trade Ecosystem"
          title="Built for Every Actor in Global Trade"
          subtitle="SeaSharp connects the entire trade lifecycle — not just buyers and sellers."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM.map((e) => (
            <div key={e.role} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{e.role}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.live ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {e.live ? "Live" : "Coming Soon"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core platform modules */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <SectionHeading
          eyebrow="Core Platform Modules"
          title="One Connected Ecosystem"
          subtitle="Each module creates value on its own. Together they form a closed loop with compounding network effects."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2">
          <PillarCard
            letter="A"
            title="Trade Intelligence"
            description="HS code lookup, tariff database, country regulations, and landed cost — instantly."
            points={[
              "HS Code Lookup & Tariff Calculator",
              "Document Checklist & Compliance Steps",
              "Country Trade Intelligence (5 zones at launch)",
              "Landed Cost Calculator",
            ]}
          />
          <PillarCard
            letter="B"
            title="Documentation"
            description="Generate and manage the full set of trade documents from structured shipment data."
            points={[
              "Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading",
              "Air Waybill, Export/Import Declaration",
              "Insurance, Inspection & Fumigation Certificates",
              "Letter of Credit support, Proforma Invoice",
            ]}
            status="Roadmap"
          />
          <PillarCard
            letter="C"
            title="RFQ Marketplace"
            description="Reverse-auction RFQ with escrow — blind bidding protects pricing integrity, funds release at verified milestones."
            points={[
              "Blind Bidding",
              "Escrow Milestone Release",
              "KYC/KYB Verified Exporters",
              "SeaSharp Trust Score (STS) placement",
            ]}
          />
          <PillarCard
            letter="D"
            title="Logistics & Tracking"
            description="End-to-end digital freight forwarding from exporter warehouse to importer godown."
            points={[
              "Pickup → port / airport → customs → delivery",
              "Sea / Air freight with port handling",
              "Customs clearance automation",
              "Live milestone tracking dashboard",
            ]}
          />
          <PillarCard
            letter="E"
            title="Trade Finance"
            description="PO-backed trade finance marketplace — risk-calibrated working capital no bank offers SMEs."
            points={[
              "PO Financing on verified purchase orders",
              "Institutional & private credit investors",
              "Automatic repayment via escrow routing",
              "STS-gated interest rates",
            ]}
          />
          <PillarCard
            letter="F"
            title="Verification & Trust"
            description="KYC, KYB, company registration, tax verification, and trade history feed a single trust score."
            points={[
              "Business & tax verification",
              "Trade history & performance tracking",
              "SeaSharp Trust Score (STS)",
              "Premium badge for trusted partners",
            ]}
          />
          <PillarCard
            letter="G"
            title="Security Platform"
            description="Enterprise-grade security designed by someone who models the attacker."
            points={[
              "Zero Trust architecture",
              "Document hashing & audit logs",
              "Threat monitoring & fraud detection",
              "Multi-factor authentication",
            ]}
            status="Roadmap"
          />
        </div>
      </section>

      {/* AI modules */}
      <section className="px-6 py-24">
        <SectionHeading
          eyebrow="SeaSharp AI"
          title="AI Modules That Make the Platform Self-Improving"
          subtitle="Every transaction trains the models. Every model makes the next transaction cheaper, faster, and safer."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_MODULES.map((m) => (
            <div key={m.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-emerald-400">{m.name}</h3>
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  Live
                </span>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{m.tag}</p>
              <p className="mt-2 text-sm text-slate-400">{m.body}</p>
            </div>
          ))}
          {AI_MODULES_ROADMAP.map((m) => (
            <div key={m.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-300">{m.name}</h3>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                  Roadmap
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STS */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <SectionHeading
          eyebrow="SeaSharp Trust Score"
          title="STS — The Credit Score for Trade"
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

        <div className="mx-auto mt-12 max-w-4xl rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="font-semibold text-slate-100">Revenue Model</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {REVENUE_STREAMS.map((r) => (
              <span key={r} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <SectionHeading
          eyebrow="Roadmap"
          title="From Foundation to Global Infrastructure"
          subtitle="Each phase funds and unlocks the next."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((p) => (
            <div key={p.phase} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  {p.phase}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "Live"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <h3 className="mt-1 font-semibold text-slate-100">{p.title}</h3>
              <ul className="mt-3 space-y-1.5">
                {p.items.map((item) => (
                  <li key={item} className="text-sm text-slate-400">
                    → {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-slate-50">One platform. Every trade. Anywhere in the world.</h2>
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
        SeaSharp — The Global Trade Infrastructure Platform · Founder: Nisarg Dedakiya
      </footer>
    </main>
  );
}
