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
          <div className="group h-full rounded-xl border border-ink-100 bg-white p-6 shadow-premium transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-premium-lg">
            <span className="text-3xl font-bold text-gold-500/30 transition-colors duration-300 group-hover:text-gold-500/70">
              {s.step}
            </span>
            <h3 className="mt-3 font-semibold text-ink-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.body}</p>
          </div>
        </RevealStaggerItem>
      ))}
    </RevealStagger>
  );
}
