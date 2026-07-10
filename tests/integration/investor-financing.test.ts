import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking approach as tests/integration/rfq-lifecycle.test.ts — see
// that file's comment for why getSessionActor()/getSessionUser() are
// mocked rather than exercised through real cookie-based auth.
type MockActor = {
  user: { id: string; email: string; fullName: string };
  organization: { id: string; type: string; stsScore: number; kycStatus: string };
} | null;
let mockActor: MockActor = null;

vi.mock("@/core/identity/session", () => ({
  getSessionActor: vi.fn(() => Promise.resolve(mockActor)),
  getSessionUser: vi.fn(() => Promise.resolve(mockActor?.user ?? null)),
}));

import { POST as registerUser } from "@/app/api/auth/register/route";
import { POST as createRfq } from "@/app/api/rfqs/route";
import { POST as submitBid } from "@/app/api/rfqs/[id]/bids/route";
import { POST as awardBid } from "@/app/api/rfqs/[id]/award/route";
import { POST as requestLoan, GET as getLoans } from "@/app/api/loans/route";
import { POST as fundLoan } from "@/app/api/investments/[id]/fund/route";
import { serviceDb } from "@/db/client";
import { countries, hsCodes, tariffs } from "@/db/schema";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedTradeReferenceData() {
  await serviceDb.insert(countries).values([
    { code: "IN", name: "India", region: "INDIA" },
    { code: "AE", name: "United Arab Emirates", region: "UAE" },
  ]);
  await serviceDb.insert(hsCodes).values({ code: "0909.31", description: "Cumin seeds, whole", category: "Spices" });
  await serviceDb.insert(tariffs).values({
    hsCode: "0909.31",
    originCountry: "IN",
    destinationCountry: "AE",
    dutyRatePercent: "0",
    additionalFeePercent: "5",
  });
}

async function registerAndGetActor(overrides: Record<string, unknown>) {
  const res = await registerUser(
    jsonRequest("http://localhost/api/auth/register", {
      name: "Test User",
      email: `${crypto.randomUUID()}@test.com`,
      password: "password123",
      role: "EXPORTER",
      ...overrides,
    }),
    { params: {} }
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  return {
    user: { id: body.id as string, email: body.email as string, fullName: (overrides.name as string) ?? "Test User" },
    organization: {
      id: body.organizationId as string,
      type: (overrides.role as string) ?? "EXPORTER",
      stsScore: 0,
      kycStatus: "UNVERIFIED",
    },
  };
}

// Financing is scored off actor.organization.stsScore (see
// src/core/ai/credit-ai.ts's tierForScore) — a brand-new org starts at 0
// ("NEW" tier, always rejected), so tests that need an APPROVED decision
// bump the mock actor straight to a VERIFIED-tier score rather than
// simulating an entire shipment history just to move the real STS number.
function withStsScore<T extends { organization: { stsScore: number } }>(actor: T, stsScore: number): T {
  return { ...actor, organization: { ...actor.organization, stsScore } };
}

describe("Investor financing marketplace (exporter/importer requests, investor funds)", () => {
  beforeEach(() => {
    mockActor = null;
  });

  it("lets an exporter request export-purchase financing and an investor fund it", async () => {
    await seedTradeReferenceData();

    const importer = await registerAndGetActor({ role: "IMPORTER", companyName: "Dubai Spice Co" });
    const exporter = await registerAndGetActor({ role: "EXPORTER", companyName: "Rajkot Exports" });
    const investor = await registerAndGetActor({ role: "INVESTOR", companyName: "Gulf Capital Partners" });

    mockActor = importer;
    const rfqRes = await createRfq(
      jsonRequest("http://localhost/api/rfqs", {
        product: "Cumin seeds",
        hsCode: "0909.31",
        originCountry: "IN",
        destinationCountry: "AE",
        volume: 5000,
        unit: "kg",
        targetPricePerUnit: 3.5,
        currency: "USD",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { params: {} }
    );
    expect(rfqRes.status).toBe(201);
    const rfq = await rfqRes.json();

    mockActor = exporter;
    const bidRes = await submitBid(
      jsonRequest(`http://localhost/api/rfqs/${rfq.id}/bids`, { pricePerUnit: 3.2, message: "Can ship in 2 weeks" }),
      { params: { id: rfq.id } }
    );
    expect(bidRes.status).toBe(201);
    const bid = await bidRes.json();

    mockActor = importer;
    const awardRes = await awardBid(jsonRequest(`http://localhost/api/rfqs/${rfq.id}/award`, { bidId: bid.id }), {
      params: { id: rfq.id },
    });
    expect(awardRes.status).toBe(201);
    const { escrow } = await awardRes.json();

    // Exporter requests pre-shipment financing ("funds to buy and export")
    // against the verified PO. Bump STS to a VERIFIED tier so CreditLayer
    // approves it — see withStsScore's comment.
    mockActor = withStsScore(exporter, 500);
    const loanRes = await requestLoan(
      jsonRequest("http://localhost/api/loans", { rfqId: rfq.id, requestedAmount: 5000 }),
      { params: {} }
    );
    expect(loanRes.status).toBe(201);
    const { loan, decision } = await loanRes.json();
    expect(decision.approved).toBe(true);
    expect(loan.status).toBe("APPROVED");
    expect(loan.approvedAmount).toBeLessThanOrEqual(Number(escrow.amount));

    // A Member of a different org (the importer, still just an org — not an
    // investor) can't fund it.
    mockActor = importer;
    const wrongRoleFund = await fundLoan(new Request(`http://localhost/api/investments/${loan.id}/fund`, { method: "POST" }), {
      params: { id: loan.id },
    });
    expect(wrongRoleFund.status).toBe(403);

    // The investor funds the approved, still-unfunded request.
    mockActor = investor;
    const fundRes = await fundLoan(new Request(`http://localhost/api/investments/${loan.id}/fund`, { method: "POST" }), {
      params: { id: loan.id },
    });
    expect(fundRes.status).toBe(200);
    const fundedLoan = await fundRes.json();
    expect(fundedLoan.status).toBe("FUNDED");
    expect(fundedLoan.investorOrganizationId).toBe(investor.organization.id);

    // Funding is a one-shot commitment — a second investor can't also fund
    // the same, now-already-funded request.
    const secondInvestor = await registerAndGetActor({ role: "INVESTOR", companyName: "Rival Capital" });
    mockActor = secondInvestor;
    const doubleFund = await fundLoan(new Request(`http://localhost/api/investments/${loan.id}/fund`, { method: "POST" }), {
      params: { id: loan.id },
    });
    expect(doubleFund.status).toBe(404);

    // The exporter's own loan list now reflects FUNDED.
    mockActor = exporter;
    const listRes = await getLoans(new Request("http://localhost/api/loans"), { params: {} });
    const list = await listRes.json();
    expect(list.find((l: { id: string }) => l.id === loan.id).status).toBe("FUNDED");
  });

  it("lets an importer request import-purchase financing against an RFQ they posted", async () => {
    await seedTradeReferenceData();

    const importer = await registerAndGetActor({ role: "IMPORTER", companyName: "Abu Dhabi Traders" });
    const exporter = await registerAndGetActor({ role: "EXPORTER", companyName: "Gujarat Exports" });
    const investor = await registerAndGetActor({ role: "INVESTOR", companyName: "Trade Finance Fund" });

    mockActor = importer;
    const rfqRes = await createRfq(
      jsonRequest("http://localhost/api/rfqs", {
        product: "Cumin seeds",
        hsCode: "0909.31",
        originCountry: "IN",
        destinationCountry: "AE",
        volume: 2000,
        unit: "kg",
        targetPricePerUnit: 4,
        currency: "USD",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { params: {} }
    );
    const rfq = await rfqRes.json();

    mockActor = exporter;
    const bidRes = await submitBid(jsonRequest(`http://localhost/api/rfqs/${rfq.id}/bids`, { pricePerUnit: 3.8 }), {
      params: { id: rfq.id },
    });
    const bid = await bidRes.json();

    mockActor = importer;
    const awardRes = await awardBid(jsonRequest(`http://localhost/api/rfqs/${rfq.id}/award`, { bidId: bid.id }), {
      params: { id: rfq.id },
    });
    expect(awardRes.status).toBe(201);

    // Importer requests import-purchase financing ("funds to import and
    // resell domestically") against the same verified deal, on their side
    // of it this time.
    mockActor = withStsScore(importer, 500);
    const loanRes = await requestLoan(
      jsonRequest("http://localhost/api/loans", { rfqId: rfq.id, requestedAmount: 3000 }),
      { params: {} }
    );
    expect(loanRes.status).toBe(201);
    const { loan, decision } = await loanRes.json();
    expect(decision.approved).toBe(true);
    expect(loan.status).toBe("APPROVED");
    expect(loan.requestingOrgType).toBe("IMPORTER");

    mockActor = investor;
    const fundRes = await fundLoan(new Request(`http://localhost/api/investments/${loan.id}/fund`, { method: "POST" }), {
      params: { id: loan.id },
    });
    expect(fundRes.status).toBe(200);
    expect((await fundRes.json()).status).toBe("FUNDED");
  });
});
