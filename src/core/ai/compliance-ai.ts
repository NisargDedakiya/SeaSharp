export type SupplierRadarResult = {
  cleared: boolean;
  flags: string[];
};

export type BeneficialOwnerInput = {
  name?: string | null;
  ownershipPercent?: number | null;
};

// SupplierRadar stub: production version continuously OSINT-monitors company
// registrations, export records, and social signals (spec section 06). For
// Phase 1 this runs a same-request heuristic check against the submitted
// KYC/KYB fields (legal company name, registration number, tax ID, country
// of registration, and beneficial ownership — see
// docs/02-product-requirements.md §1.4) so the rest of the platform (STS,
// bid eligibility) has a real KycStatus to key off of. No real anomaly
// detection or registry lookups — just field-presence/shape validation,
// honestly labeled as a heuristic, not OSINT.
export function runSupplierCheck(params: {
  companyName?: string | null;
  legalCompanyName?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  country?: string | null;
  phone?: string | null;
  beneficialOwners?: BeneficialOwnerInput[] | null;
}): SupplierRadarResult {
  const flags: string[] = [];

  const legalName = params.legalCompanyName ?? params.companyName;
  if (!legalName || legalName.trim().length < 2) {
    flags.push("Missing or invalid registered company name.");
  }
  if (!params.country) {
    flags.push("Missing country of registration.");
  }
  // phone is only collected via the legacy dashboard-profile path; only
  // flag it when the caller actually passed the field.
  if (params.phone !== undefined && !params.phone) {
    flags.push("Missing verifiable contact number.");
  }
  if (params.registrationNumber !== undefined) {
    if (!params.registrationNumber || params.registrationNumber.trim().length < 3) {
      flags.push("Missing or invalid company registration number.");
    }
  }
  if (params.taxId !== undefined) {
    if (!params.taxId || params.taxId.trim().length < 3) {
      flags.push("Missing or invalid tax ID.");
    }
  }
  if (params.beneficialOwners !== undefined) {
    const owners = params.beneficialOwners ?? [];
    const validOwners = owners.filter((o) => o.name && o.name.trim().length >= 2);
    if (validOwners.length === 0) {
      flags.push("At least one beneficial owner with a valid name is required.");
    }
    const invalidOwnership = owners.some(
      (o) =>
        o.ownershipPercent != null && (o.ownershipPercent < 0 || o.ownershipPercent > 100)
    );
    if (invalidOwnership) {
      flags.push("Beneficial owner ownership percentage must be between 0 and 100.");
    }
  }

  return { cleared: flags.length === 0, flags };
}
