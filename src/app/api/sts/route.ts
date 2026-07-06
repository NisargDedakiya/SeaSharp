import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { tierForScore } from "@/lib/sts";
import { recalculateAndSaveSts } from "@/lib/sts-server";

export const GET = withApiHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AppError(401, "Sign in required.");
  }

  const breakdown = await recalculateAndSaveSts(session.user.id);
  return NextResponse.json({ ...breakdown, tier: tierForScore(breakdown.totalScore) });
});
