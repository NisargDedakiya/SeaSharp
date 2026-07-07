import { NextResponse } from "next/server";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { tierForScore } from "@/lib/sts";
import { recalculateAndSaveSts } from "@/lib/sts-server";
import { getSessionActor } from "@/lib/session";

export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const breakdown = await recalculateAndSaveSts(actor.organization.id);
  return NextResponse.json({ ...breakdown, tier: tierForScore(breakdown.totalScore) });
});
