import { RevealStagger, RevealStaggerItem } from "@/components/Reveal";

const STEPS = [
  {
    step: "01",
    title: "Post or Browse",
    body: "Importers post an RFQ with volume, target price, and deadline. Exporters browse live listings filtered to their product and corridor.",
  },
  {
    step: "02",
    title: "Get Verified Bids",
    body: "KYC/KYB-verified exporters submit blind bids. Every bid carries its exporter's SeaSharp Trust Score, so pricing stays competitive and vetted.",
  },
  {
    step: "03",
    title: "Award & Fund Escrow",
    body: "The importer awards the best bid. Funds move into milestone-based escrow — nothing releases until each shipment milestone is verified.",
  },
  {
    step: "04",
    title: "Track to Delivery",
    body: "Shipment milestones update in real time from pickup to customs to delivery, with escrow releasing automatically as milestones clear.",
  },
];

export function HowItWorks() {
  return (
    <RevealStagger className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s) => (
        <RevealStaggerItem key={s.step}>
          <div className="group h-full rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/70 hover:shadow-[0_0_30px_-14px_rgba(56,189,248,0.5)]">
            <span className="text-3xl font-bold text-sky-500/30 transition-colors duration-300 group-hover:text-sky-400/60">
              {s.step}
            </span>
            <h3 className="mt-3 font-semibold text-slate-100">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
          </div>
        </RevealStaggerItem>
      ))}
    </RevealStagger>
  );
}
