import { redirect } from "next/navigation";
import { getSessionActor } from "@/core/identity/session";
import { VerificationForm } from "./VerificationForm";

export const dynamic = "force-dynamic";

// KYC/KYB verification page — docs/02-product-requirements.md §1.4.
// Applies to every organization type (importer, exporter, freight
// forwarder, ...), not gated on organization.type, unlike the STS
// recalculation which is exporter-only inside the submit route.
export default async function VerificationPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-ink-900">Company Verification</h1>
      <p className="mt-2 text-sm text-ink-500">
        Submit your registration documents, tax ID, and beneficial-ownership information so
        SupplierRadar/ComplianceAI can verify {actor.organization.name} for trading, escrow, and
        trade finance eligibility.
      </p>

      <VerificationForm initialKycStatus={actor.organization.kycStatus} />
    </main>
  );
}
