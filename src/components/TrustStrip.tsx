const BADGES = [
  {
    label: "Escrow-Protected Payments",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 3v5c0 4.5-3 8.4-7 9.5-4-1.1-7-5-7-9.5V6l7-3z"
      />
    ),
  },
  {
    label: "KYC/KYB Verified Members",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  },
  {
    label: "Encrypted Trade Documents",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-5-2h10a1 1 0 001-1v-4a1 1 0 00-1-1H7a1 1 0 00-1 1v4a1 1 0 001 1zm1-6V7a3 3 0 116 0v2"
      />
    ),
  },
  {
    label: "SeaSharp Trust Score on Every Bid",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
];

export function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 ${className}`}>
      {BADGES.map((badge) => (
        <div key={badge.label} className="flex items-center gap-2 text-sm text-slate-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-4 w-4 shrink-0 text-sky-400"
          >
            {badge.icon}
          </svg>
          {badge.label}
        </div>
      ))}
    </div>
  );
}
