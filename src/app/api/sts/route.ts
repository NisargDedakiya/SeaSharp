import { NextResponse } from "next/server";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { tierForScore } from "@/core/finance/sts";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { getSessionActor } from "@/core/identity/session";

export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const breakdown = await recalculateAndSaveSts(actor.organization.id);
  return NextResponse.json({ ...breakdown, tier: tierForScore(breakdown.totalScore) });
});
