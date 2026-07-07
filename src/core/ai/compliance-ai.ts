export type SupplierRadarResult = {
  cleared: boolean;
  flags: string[];
};

// SupplierRadar stub: production version continuously OSINT-monitors company
// registrations, export records, and social signals (spec section 06). For
// Phase 1 this runs a same-request heuristic check against the submitted
// KYC/KYB fields so the rest of the platform (STS, bid eligibility) has a
// real KycStatus to key off of.
export function runSupplierCheck(params: {
  companyName?: string | null;
  country?: string | null;
  phone?: string | null;
}): SupplierRadarResult {
  const flags: string[] = [];
  if (!params.companyName || params.companyName.trim().length < 2) {
    flags.push("Missing or invalid registered company name.");
  }
  if (!params.country) {
    flags.push("Missing country of registration.");
  }
  if (!params.phone) {
    flags.push("Missing verifiable contact number.");
  }

  return { cleared: flags.length === 0, flags };
}
