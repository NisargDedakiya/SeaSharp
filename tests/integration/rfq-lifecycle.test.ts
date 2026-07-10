import { describe, it, expect, vi, beforeEach } from "vitest";

// The route handlers call getSessionActor()/getSessionUser() from
// @/core/identity/session, which reads a signed cookie via next/headers — not
// meaningful in a direct route-handler-function-call test. Mocking the
// module lets each request simulate being signed in as a different
// organization without running real cookie-based auth end to end.
type MockActor = {
  user: { id: string; email: string; fullName: string };
  organization: { id: string; type: string; stsScore: number; kycStatus: string };
} | null;
let mockActor: MockActor = null;

// Deliberately not spreading the real module's exports: @/core/identity/session
// imports next/headers's cookies(), which only works inside a real Next.js
// server request context, not a bare route-handler-function-call test.
vi.mock("@/core/identity/session", () => ({
  getSessionActor: vi.fn(() => Promise.resolve(mockActor)),
  getSessionUser: vi.fn(() => Promise.resolve(mockActor?.user ?? null)),
}));

import { POST as registerUser } from "@/app/api/auth/register/route";
import { POST as createRfq } from "@/app/api/rfqs/route";
import { POST as submitBid } from "@/app/api/rfqs/[id]/bids/route";
import { GET as getRfq } from "@/app/api/rfqs/[id]/route";
import { POST as awardBid } from "@/app/api/rfqs/[id]/award/route";
import { POST as releaseMilestone } from "@/app/api/escrow/[id]/release/route";
import { GET as getSts } from "@/app/api/sts/route";
import { POST as requestLoan } from "@/app/api/loans/route";
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

describe("RFQ lifecycle (post -> bid -> award -> escrow -> STS -> financing)", () => {
  beforeEach(() => {
    mockActor = null;
  });

  it("runs the full trade lifecycle and updates STS + financing eligibility", async () => {
    await seedTradeReferenceData();

    const importer = await registerAndGetActor({ role: "IMPORTER", companyName: "Dubai Spice Co" });
    const exporter = await registerAndGetActor({ role: "EXPORTER", companyName: "Rajkot Exports" });

    // --- Post an RFQ as the importer ---
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

    // --- Submit a bid as the exporter ---
    mockActor = exporter;
    const bidRes = await submitBid(
      jsonRequest(`http://localhost/api/rfqs/${rfq.id}/bids`, { pricePerUnit: 3.2, message: "Can ship in 2 weeks" }),
      { params: { id: rfq.id } }
    );
    expect(bidRes.status).toBe(201);
    const bid = await bidRes.json();
    expect(bid.aiSuggestedPrice).toBeCloseTo(3.5 * 0.97, 2);

    // Blind bidding: the exporter's own view of the RFQ shows their bid but
    // not a rival's price (there's only one bid here, but the count is verifiable).
    const detailRes = await getRfq(new Request(`http://localhost/api/rfqs/${rfq.id}`), {
      params: { id: rfq.id },
    });
    const detail = await detailRes.json();
    expect(detail.totalBidCount).toBe(1);

    // --- Award the bid as the importer ---
    mockActor = importer;
    const awardRes = await awardBid(jsonRequest(`http://localhost/api/rfqs/${rfq.id}/award`, { bidId: bid.id }), {
      params: { id: rfq.id },
    });
    expect(awardRes.status).toBe(201);
    const { escrow, shipment } = await awardRes.json();
    expect(escrow.amount).toBeCloseTo(3.2 * 5000, 2);
    expect(shipment.mode).toBe("SEA");

    // --- Progress escrow milestones as the exporter until fulfillment ---
    mockActor = exporter;
    let lastEscrow;
    for (let i = 0; i < 4; i++) {
      const releaseRes = await releaseMilestone(new Request(`http://localhost/api/escrow/${escrow.id}/release`, { method: "POST" }), {
        params: { id: escrow.id },
      });
      expect(releaseRes.status).toBe(200);
      lastEscrow = await releaseRes.json();
    }
    expect(lastEscrow.status).toBe("RELEASED");

    // --- STS should now reflect a completed, on-time, dispute-free trade ---
    const stsRes = await getSts(new Request("http://localhost/api/sts"), { params: {} });
    const sts = await stsRes.json();
    expect(sts.onTimeDeliveryPoints).toBe(240); // full marks: 1/1 shipments on time
    expect(sts.totalScore).toBeGreaterThan(0);

    // --- PO-backed financing becomes available against the fulfilled RFQ ---
    const loanRes = await requestLoan(
      jsonRequest("http://localhost/api/loans", { rfqId: rfq.id, requestedAmount: 5000 }),
      { params: {} }
    );
    expect(loanRes.status).toBe(201);
    const { loan, decision } = await loanRes.json();
    expect(loan.status).toBe(decision.approved ? "APPROVED" : "REJECTED");
  });
});
