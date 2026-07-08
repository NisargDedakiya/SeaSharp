import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSupabaseAdmin, supabaseConfigured } from "@/core/identity/adapter";
import { env } from "@/lib/env";

// Kicks off Supabase Auth's native password-recovery email. Requires a
// configured Supabase project — there's no local-fallback equivalent (the
// local bcrypt adapter has no email delivery/token-verification story), so
// this 503s when Supabase isn't configured, same as the other new
// Supabase-only routes in this directory (reset-password, verify-email).
//
// NOT verified against a live Supabase project — see docs/README.md's gap
// table. Mechanically correct per the supabase-js docs; untestable here
// because this sandbox has no real Supabase credentials.
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    if (!supabaseConfigured) {
      throw new AppError(503, "Password reset requires a configured Supabase project.");
    }

    const { error } = await getSupabaseAdmin().auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${env.APP_URL}/reset-password`,
    });
    // Deliberately don't leak whether the email exists — always return the
    // same response, matching Supabase's own anti-enumeration behavior.
    if (error) {
      throw new AppError(500, "Could not send password reset email.");
    }

    return NextResponse.json({ ok: true });
  },
  { rateLimit: { limit: 10, windowMs: 10 * 60_000 } }
);
