import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "text-emerald-700",
  PENDING: "text-amber-700",
  REJECTED: "text-rose-700",
  UNVERIFIED: "text-ink-500",
};

const STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Verified by SupplierRadar",
  PENDING: "Pending review",
  REJECTED: "Rejected",
  UNVERIFIED: "Not started",
};

export function KycPanel({ kycStatus }: { kycStatus: string }) {
  const statusClass = STATUS_STYLES[kycStatus] ?? "text-ink-500";
  const statusLabel = STATUS_LABELS[kycStatus] ?? kycStatus;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">KYC / KYB</h2>
      <p className={`mt-2 text-sm font-medium ${statusClass}`}>
        {kycStatus === "VERIFIED" ? "✓ " : ""}
        {statusLabel}
      </p>
      <p className="mt-1 text-sm text-ink-500">
        {kycStatus === "VERIFIED"
          ? "Your company verification is complete."
          : "Submit registration documents, tax ID, and beneficial-ownership info for verification."}
      </p>
      <Link
        href="/verification"
        className="mt-3 inline-block rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
      >
        {kycStatus === "VERIFIED" ? "View Verification" : "Complete Verification"}
      </Link>
    </div>
  );
}
