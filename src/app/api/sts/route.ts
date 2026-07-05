import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recalculateAndSaveSts, tierForScore } from "@/lib/sts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const breakdown = await recalculateAndSaveSts(session.user.id);
  return NextResponse.json({ ...breakdown, tier: tierForScore(breakdown.totalScore) });
}
