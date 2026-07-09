"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRY_NAMES } from "@/lib/countries";

type Owner = { name: string; ownershipPercent: string };

type Submission = {
  id: string;
  legalCompanyName: string;
  country: string;
  status: string;
  flags: string[];
  createdAt: string;
  reviewedAt: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  UNVERIFIED: "bg-ink-50 text-ink-500 border-ink-100",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? STATUS_BADGE.UNVERIFIED;
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export function VerificationForm({ initialKycStatus }: { initialKycStatus: string }) {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState(initialKycStatus);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [legalCompanyName, setLegalCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [country, setCountry] = useState("");
  const [owners, setOwners] = useState<Owner[]>([{ name: "", ownershipPercent: "" }]);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/verification");
    if (!res.ok) return;
    const data = await res.json();
    setKycStatus(data.kycStatus);
    setSubmissions(data.submissions);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function updateOwner(index: number, field: keyof Owner, value: string) {
    setOwners((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  function addOwner() {
    setOwners((prev) => [...prev, { name: "", ownershipPercent: "" }]);
  }

  function removeOwner(index: number) {
    setOwners((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function uploadFile(file: File, documentKind: "REGISTRATION" | "TAX"): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentKind", documentKind);
    const res = await fetch("/api/verification/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Upload failed.");
    }
    const data = await res.json();
    return data.id as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFlags([]);
    try {
      let registrationDocumentFileId: string | null = null;
      let taxDocumentFileId: string | null = null;
      if (registrationFile) {
        registrationDocumentFileId = await uploadFile(registrationFile, "REGISTRATION");
      }
      if (taxFile) {
        taxDocumentFileId = await uploadFile(taxFile, "TAX");
      }

      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalCompanyName,
          registrationNumber,
          taxId,
          country,
          beneficialOwners: owners
            .filter((o) => o.name.trim().length > 0)
            .map((o) => ({
              name: o.name,
              ownershipPercent: o.ownershipPercent ? Number(o.ownershipPercent) : null,
            })),
          registrationDocumentFileId,
          taxDocumentFileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Submission failed.");
      }
      setKycStatus(data.kycStatus);
      setFlags(data.flags ?? []);
      await loadStatus();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500";

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Current Status</h2>
          <StatusBadge status={kycStatus} />
        </div>

        {flags.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Flags from your last submission:</p>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
              {flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {kycStatus !== "VERIFIED" && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-premium"
        >
          <h2 className="font-semibold text-ink-900">Verification Details</h2>

          {error && <p className="text-sm text-rose-700">{error}</p>}

          <div>
            <label className="text-sm font-medium text-ink-700">Legal company name</label>
            <input
              className={inputClass}
              value={legalCompanyName}
              onChange={(e) => setLegalCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink-700">Registration number</label>
              <input
                className={inputClass}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Tax ID</label>
              <input
                className={inputClass}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700">Country of registration</label>
            <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} required>
              <option value="">Select a country</option>
              {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700">Beneficial owner(s)</label>
            <div className="mt-2 space-y-3">
              {owners.map((owner, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Owner full name"
                    value={owner.name}
                    onChange={(e) => updateOwner(index, "name", e.target.value)}
                  />
                  <input
                    className={`${inputClass} w-32`}
                    placeholder="% owned"
                    type="number"
                    min={0}
                    max={100}
                    value={owner.ownershipPercent}
                    onChange={(e) => updateOwner(index, "ownershipPercent", e.target.value)}
                  />
                  {owners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOwner(index)}
                      className="rounded-md border border-ink-100 px-3 text-sm text-ink-500 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOwner}
              className="mt-2 text-sm font-medium text-gold-600 hover:text-gold-700"
            >
              + Add another owner
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink-700">Registration document</label>
              <input
                type="file"
                className="mt-1 w-full text-sm text-ink-700"
                onChange={(e) => setRegistrationFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Tax document</label>
              <input
                type="file"
                className="mt-1 w-full text-sm text-ink-700"
                onChange={(e) => setTaxFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500"
          >
            {loading ? "Submitting..." : "Submit for Verification"}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
        <h2 className="font-semibold text-ink-900">Submission History</h2>
        {submissions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No submissions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{s.legalCompanyName}</p>
                  <p className="text-xs text-ink-500">
                    {new Date(s.createdAt).toLocaleString()} · {s.country}
                  </p>
                  {s.flags.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs text-rose-700">
                      {s.flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
