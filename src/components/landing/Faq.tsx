"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What is SeaSharp?",
    a: "SeaSharp is a trade infrastructure platform that connects importers and exporters through a reverse-auction RFQ marketplace, with built-in escrow, trade documentation, and financing tools to move a deal from quote to delivery.",
  },
  {
    q: "How does escrow protect my payment?",
    a: "Once an RFQ is awarded, the importer's funds are held in escrow and released in stages as shipment milestones are verified — never all at once, and never before the corresponding milestone clears.",
  },
  {
    q: "How is the SeaSharp Trust Score (STS) calculated?",
    a: "STS is a 0–1000 score built from five weighted factors: KYC/KYB verification, on-time delivery history, escrow release speed, dispute rate, and trade loan repayment history. It updates as an exporter completes more trades.",
  },
  {
    q: "Is KYC/KYB verification required?",
    a: "Verification isn't required to create an account, but it directly affects your SeaSharp Trust Score, bid visibility, and trade finance eligibility — most active exporters complete it before their first bid.",
  },
  {
    q: "Which trade corridors are supported today?",
    a: "Phase 1 focuses on the India → UAE corridor for agricultural exports, with country trade intelligence covering five zones at launch and more corridors planned as the platform scales.",
  },
  {
    q: "Is there a fee to use SeaSharp?",
    a: "Core RFQ posting and bidding are free. SeaSharp earns from escrow processing fees, logistics commissions, and trade finance commissions — only charged when a deal actually moves.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-12 max-w-3xl divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white shadow-premium">
      {FAQS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="font-medium text-ink-900">{item.q}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className={`h-4 w-4 shrink-0 text-gold-600 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={`grid overflow-hidden transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-4 text-sm leading-relaxed text-ink-500">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
