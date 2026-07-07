import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { signInWithPassword, signSessionToken, SESSION_COOKIE } from "@/core/identity/adapter";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches adapter.ts's token TTL

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await signInWithPassword({ email, password });
    const token = await signSessionToken({ sub: user.id, email: user.email });

    const response = NextResponse.json({ id: user.id, email: user.email });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  },
  { rateLimit: { limit: 20, windowMs: 10 * 60_000 } }
);
