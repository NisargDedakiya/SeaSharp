import { NextResponse } from "next/server";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { fundRequest } from "@/core/finance/funding";

// Investor / finance partner commits to an open funding request — the
// eligibility and OPEN-state race guard live in fundRequest
// (src/core/finance/funding.ts).
export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const fundingRequest = await fundRequest(params.id, actor);
  return NextResponse.json({ fundingRequest });
});
