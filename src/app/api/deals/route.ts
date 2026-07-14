import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { confirmDeal, listDealsForOrganization } from "@/core/trade/deals";

const confirmSchema = z.object({ rfqId: z.string() });

// Deals the caller's organization is party to (importer or exporter side) —
// backs the Deals dashboard widget for both roles.
export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }
  const deals = await listDealsForOrganization(actor.organization.id);
  return NextResponse.json(deals);
});

// Importer confirms an awarded RFQ into a Deal with the winning exporter —
// ownership/status checks live in confirmDeal (src/core/trade/deals.ts).
export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const body = await request.json();
  const { rfqId } = confirmSchema.parse(body);

  const deal = await confirmDeal(rfqId, actor);
  return NextResponse.json({ deal }, { status: 201 });
});
