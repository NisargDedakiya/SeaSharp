import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { registerUserAndOrganization } from "@/lib/auth/register";
import { signSessionToken, SESSION_COOKIE } from "@/lib/auth/adapter";
import type { organizationTypeEnum } from "@/db/schema";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["EXPORTER", "IMPORTER"]),
  companyName: z.string().optional(),
  country: z.string().optional(),
});

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches adapter.ts's token TTL

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { name, email, password, role, companyName, country } = registerSchema.parse(body);

    // Every ecosystem role in organizationTypeEnum is schema-ready (see
    // docs/01-product-vision.md), but only Exporter/Importer have a live
    // registration flow in this phase — same scope boundary as Phase 1.
    const organizationType: (typeof organizationTypeEnum.enumValues)[number] = role;

    const result = await registerUserAndOrganization({
      email,
      password,
      fullName: name,
      organizationName: companyName || name,
      organizationType,
      country,
    });

    const token = await signSessionToken({ sub: result.userId, email: result.email });

    const response = NextResponse.json(
      { id: result.userId, email: result.email, organizationId: result.organizationId },
      { status: 201 }
    );
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  },
  { rateLimit: { limit: 10, windowMs: 10 * 60_000 } }
);
