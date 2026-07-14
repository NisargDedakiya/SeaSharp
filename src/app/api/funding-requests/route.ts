import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import {
  FUNDING_REQUEST_KINDS,
  createFundingRequest,
  listFundingRequestsForExporter,
  listOpenFundingRequests,
} from "@/core/finance/funding";

const createSchema = z.object({
  dealId: z.string(),
  kind: z.enum(FUNDING_REQUEST_KINDS),
  requestedAmount: z.coerce.number().positive(),
  note: z.string().max(1000).optional(),
});

// Exporters see their own requests; investors / finance partners see the
// open book of requests they could fund. Other org types have no view here.
export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }
  if (actor.organization.type === "EXPORTER") {
    return NextResponse.json(await listFundingRequestsForExporter(actor.organization.id));
  }
  if (actor.organization.type === "INVESTOR" || actor.organization.type === "FINANCE_PARTNER") {
    return NextResponse.json(await listOpenFundingRequests());
  }
  throw new AppError(403, "No funding-request view for this organization type.");
});

// Exporter raises a loan / funds-advance ask against one of their confirmed
// deals, addressed to the investor pool — see src/core/finance/funding.ts.
export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const body = await request.json();
  const params = createSchema.parse(body);

  const fundingRequest = await createFundingRequest(params, actor);
  return NextResponse.json({ fundingRequest }, { status: 201 });
});
