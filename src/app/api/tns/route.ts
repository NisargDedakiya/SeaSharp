import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recalculateAndSaveTns, tierForScore } from "@/lib/tns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const breakdown = await recalculateAndSaveTns(session.user.id);
  return NextResponse.json({ ...breakdown, tier: tierForScore(breakdown.totalScore) });
}
