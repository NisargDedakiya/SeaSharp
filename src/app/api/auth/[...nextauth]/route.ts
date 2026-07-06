import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/mongoose";
import { clientIpFromRequest, rateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

async function GET(request: Request, context: unknown) {
  await dbConnect();
  return handler(request, context as never);
}

// Rate limit sign-in attempts (this is where credential brute-forcing would
// land) without touching NextAuth's own request/response contract.
async function POST(request: Request, context: unknown) {
  await dbConnect();

  const url = new URL(request.url);
  if (url.pathname.endsWith("/callback/credentials")) {
    const ip = clientIpFromRequest(request);
    const result = rateLimit(`login:${ip}`, 20, 10 * 60_000);
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please try again later." },
        { status: 429 }
      );
    }
  }

  return handler(request, context as never);
}

export { GET, POST };
