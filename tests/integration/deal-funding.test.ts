import { describe, it, expect, vi, beforeEach } from "vitest";

// Same session-mocking approach as rfq-lifecycle.test.ts: the route
// handlers read the signed-in actor via @/core/identity/session, which
// needs next/headers cookies — mocked so each request can impersonate a
// different organization.
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
import { GET as listDeals, POST as confirmDeal } from "@/app/api/deals/route";
import { GET as listFundingRequests, POST as createFundingRequest } from "@/app/api/funding-requests/route";
import { POST as fundFundingRequest } from "@/app/api/funding-requests/[id]/fund/route";
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
      email: `seasharp.user.${crypto.randomUUID().slice(0, 8)}@gmail.com`,
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

// Drives an RFQ to AWARDED between the given importer/exporter and returns
// the ids the deal-confirmation flow needs.
async function awardedRfq(importer: NonNullable<MockActor>, exporter: NonNullable<MockActor>) {
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
    jsonRequest(`http://localhost/api/rfqs/${rfq.id}/bids`, { pricePerUnit: 3.2, message: "Ready to ship" }),
    { params: { id: rfq.id } }
  );
  expect(bidRes.status).toBe(201);
  const bid = await bidRes.json();

  mockActor = importer;
  const awardRes = await awardBid(jsonRequest(`http://localhost/api/rfqs/${rfq.id}/award`, { bidId: bid.id }), {
    params: { id: rfq.id },
  });
  expect(awardRes.status).toBe(201);

  return { rfqId: rfq.id as string };
}

describe("Deal confirmation -> exporter dashboard list -> investor funding request", () => {
  beforeEach(() => {
    mockActor = null;
  });

  it("importer confirms the deal, exporter lists it and raises funding, investor funds it", async () => {
    await seedTradeReferenceData();

    const importer = await registerAndGetActor({ role: "IMPORTER", companyName: "Dubai Spice Co" });
    const exporter = await registerAndGetActor({ role: "EXPORTER", companyName: "Rajkot Exports" });
    const investor = await registerAndGetActor({ role: "INVESTOR", companyName: "Gulf Trade Capital" });

    const { rfqId } = await awardedRfq(importer, exporter);

    // The exporter cannot confirm someone else's deal — importer-only.
    mockActor = exporter;
    const forbidden = await confirmDeal(jsonRequest("http://localhost/api/deals", { rfqId }), { params: {} });
    expect(forbidden.status).toBe(403);

    // --- Importer confirms the deal ---
    mockActor = importer;
    const confirmRes = await confirmDeal(jsonRequest("http://localhost/api/deals", { rfqId }), { params: {} });
    expect(confirmRes.status).toBe(201);
    const { deal } = await confirmRes.json();
    expect(deal.status).toBe("CONFIRMED");
    expect(deal.totalValue).toBeCloseTo(3.2 * 5000, 2); // escrowed award value
    expect(deal.exporterOrganizationId).toBe(exporter.organization.id);

    // Confirming twice is a conflict, not a second deal.
    const dupRes = await confirmDeal(jsonRequest("http://localhost/api/deals", { rfqId }), { params: {} });
    expect(dupRes.status).toBe(409);

    // --- The confirmed deal shows up in the exporter's list ---
    mockActor = exporter;
    const dealsRes = await listDeals(new Request("http://localhost/api/deals"), { params: {} });
    expect(dealsRes.status).toBe(200);
    const exporterDeals = await dealsRes.json();
    expect(exporterDeals).toHaveLength(1);
    expect(exporterDeals[0].id).toBe(deal.id);
    expect(exporterDeals[0].importer.name).toBe("Dubai Spice Co");
    expect(exporterDeals[0].fundingRequest).toBeNull();

    // --- Exporter requests a loan from investors against the deal ---
    const overAsk = await createFundingRequest(
      jsonRequest("http://localhost/api/funding-requests", {
        dealId: deal.id,
        kind: "LOAN",
        requestedAmount: 999999,
      }),
      { params: {} }
    );
    expect(overAsk.status).toBe(400); // cannot exceed deal value

    const requestRes = await createFundingRequest(
      jsonRequest("http://localhost/api/funding-requests", {
        dealId: deal.id,
        kind: "LOAN",
        requestedAmount: 10000,
        note: "Working capital to source raw cumin",
      }),
      { params: {} }
    );
    expect(requestRes.status).toBe(201);
    const { fundingRequest } = await requestRes.json();
    expect(fundingRequest.status).toBe("OPEN");

    // Only one active ask per deal.
    const dupAsk = await createFundingRequest(
      jsonRequest("http://localhost/api/funding-requests", {
        dealId: deal.id,
        kind: "ADVANCE",
        requestedAmount: 5000,
      }),
      { params: {} }
    );
    expect(dupAsk.status).toBe(409);

    // --- Investor sees the open request and funds it ---
    mockActor = investor;
    const bookRes = await listFundingRequests(new Request("http://localhost/api/funding-requests"), { params: {} });
    expect(bookRes.status).toBe(200);
    const book = await bookRes.json();
    expect(book).toHaveLength(1);
    expect(book[0].id).toBe(fundingRequest.id);
    expect(book[0].exporter.name).toBe("Rajkot Exports");
    expect(book[0].deal.importerName).toBe("Dubai Spice Co");

    const fundRes = await fundFundingRequest(
      new Request(`http://localhost/api/funding-requests/${fundingRequest.id}/fund`, { method: "POST" }),
      { params: { id: fundingRequest.id } }
    );
    expect(fundRes.status).toBe(200);
    const funded = await fundRes.json();
    expect(funded.fundingRequest.status).toBe("FUNDED");
    expect(funded.fundingRequest.funderOrganizationId).toBe(investor.organization.id);

    // A second fund attempt hits the OPEN-state guard.
    const refund = await fundFundingRequest(
      new Request(`http://localhost/api/funding-requests/${fundingRequest.id}/fund`, { method: "POST" }),
      { params: { id: fundingRequest.id } }
    );
    expect(refund.status).toBe(409);

    // Importers can't fund requests — capital-provider roles only.
    mockActor = importer;
    const importerFund = await fundFundingRequest(
      new Request(`http://localhost/api/funding-requests/${fundingRequest.id}/fund`, { method: "POST" }),
      { params: { id: fundingRequest.id } }
    );
    expect(importerFund.status).toBe(403);

    // --- Exporter's deal list now reflects the funded request ---
    mockActor = exporter;
    const finalDealsRes = await listDeals(new Request("http://localhost/api/deals"), { params: {} });
    const finalDeals = await finalDealsRes.json();
    expect(finalDeals[0].fundingRequest.status).toBe("FUNDED");
  });
});
