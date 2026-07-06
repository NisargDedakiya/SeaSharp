import Link from "next/link";
import { StatTile } from "@/components/landing/StatTile";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { PillarCard } from "@/components/landing/PillarCard";
import { HeroIntro } from "@/components/landing/HeroIntro";
import { Reveal, RevealStagger, RevealStaggerItem } from "@/components/Reveal";

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
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24">
        <div
          aria-hidden
          className="animate-aurora pointer-events-none absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-aurora pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl [animation-delay:-6s]"
        />

        <div className="relative">
          <HeroIntro />

          <RevealStagger className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            <RevealStaggerItem>
              <StatTile value="$32T" label="Global Trade / Year" />
            </RevealStaggerItem>
            <RevealStaggerItem>
              <StatTile value="80%" label="Still Managed via Email" />
            </RevealStaggerItem>
            <RevealStaggerItem>
              <StatTile value="500M+" label="SME Exporters Worldwide" />
            </RevealStaggerItem>
            <RevealStaggerItem>
              <StatTile value="$1.5T" label="SME Trade Finance Gap" />
            </RevealStaggerItem>
          </RevealStagger>
        </div>
      </section>

      {/* Trade Ecosystem */}
      <section className="px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Trade Ecosystem"
            title="Built for Every Actor in Global Trade"
            subtitle="SeaSharp connects the entire trade lifecycle — not just buyers and sellers."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM.map((e) => (
            <RevealStaggerItem key={e.role}>
              <div className="group h-full rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-100">{e.role}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.live ? "bg-sky-500/15 text-sky-400" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {e.live ? "Live" : "Coming Soon"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{e.body}</p>
              </div>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </section>

      {/* Core platform modules */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Core Platform Modules"
            title="One Connected Ecosystem"
            subtitle="Each module creates value on its own. Together they form a closed loop with compounding network effects."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2">
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
          <RevealStaggerItem>
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
          </RevealStaggerItem>
        </RevealStagger>
      </section>

      {/* AI modules */}
      <section className="px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="SeaSharp AI"
            title="AI Modules That Make the Platform Self-Improving"
            subtitle="Every transaction trains the models. Every model makes the next transaction cheaper, faster, and safer."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_MODULES.map((m) => (
            <RevealStaggerItem key={m.name}>
              <div className="group h-full rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sky-400">{m.name}</h3>
                  <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-400">
                    Live
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{m.tag}</p>
                <p className="mt-2 text-sm text-slate-400">{m.body}</p>
              </div>
            </RevealStaggerItem>
          ))}
          {AI_MODULES_ROADMAP.map((m) => (
            <RevealStaggerItem key={m.name}>
              <div className="group h-full rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-300">{m.name}</h3>
                  <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                    Roadmap
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{m.body}</p>
              </div>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </section>

      {/* STS */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="SeaSharp Trust Score"
            title="STS — The Credit Score for Trade"
            subtitle="A composite 0–1000 score for every exporter. Determines bid visibility, PO loan eligibility, and interest rate bands."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-4">
          <RevealStaggerItem>
            <StatTile value="0–400" label="New" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="401–650" label="Verified" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="651–800" label="Reliable" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="801–1000" label="Trusted Partner" />
          </RevealStaggerItem>
        </RevealStagger>
      </section>

      {/* Unit economics */}
      <section className="px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Unit Economics"
            title="Three Revenue Streams, One Transaction"
            subtitle="A single average trade transaction generates revenue from escrow, logistics, and finance simultaneously."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <RevealStaggerItem>
            <StatTile value="$25K" label="Avg. Deal Size" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="$500" label="Escrow Fee (2%)" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="$360" label="Logistics Margin (12%)" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="$120" label="Finance Yield (0.5%)" />
          </RevealStaggerItem>
        </RevealStagger>
        <RevealStagger className="mx-auto mt-4 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <RevealStaggerItem>
            <StatTile value="$980" label="Revenue / Transaction" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="500" label="Deals / Month (Yr 2)" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="$490K" label="MRR Target (Yr 2)" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <StatTile value="~$6M" label="ARR Run Rate" />
          </RevealStaggerItem>
        </RevealStagger>

        <Reveal className="mx-auto mt-12 max-w-4xl rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="font-semibold text-slate-100">Revenue Model</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {REVENUE_STREAMS.map((r) => (
              <span key={r} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {r}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Roadmap */}
      <section className="border-t border-slate-800 bg-slate-900/20 px-6 py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Roadmap"
            title="From Foundation to Global Infrastructure"
            subtitle="Each phase funds and unlocks the next."
          />
        </Reveal>
        <RevealStagger className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((p) => (
            <RevealStaggerItem key={p.phase}>
              <div className="group h-full rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                    {p.phase}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "Live"
                        ? "bg-sky-500/15 text-sky-400"
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
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-24 text-center">
        <div
          aria-hidden
          className="animate-aurora pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl"
        />
        <Reveal className="relative">
          <h2 className="text-3xl font-bold text-slate-50">One platform. Every trade. Anywhere in the world.</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Phase 1 starts with one corridor: India → UAE agricultural exports.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-gradient-to-r from-sky-500 to-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_30px_-6px_rgba(56,189,248,0.6)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Join as Exporter or Importer
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-800 px-6 py-10 text-center text-sm text-slate-500">
        SeaSharp — The Global Trade Infrastructure Platform · Founder: Nisarg Dedakiya
      </footer>
    </main>
  );
}
