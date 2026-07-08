import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { supabaseConfigured } from "@/core/identity/adapter";
import { env } from "@/lib/env";

// Completes a Supabase Auth password-recovery flow: the client follows the
// recovery link from the forgot-password email, which lands it on a page
// carrying Supabase's `access_token`/`refresh_token` recovery session in the
// URL fragment; that page posts them here along with the new password.
//
// NOT verified against a live Supabase project — see docs/README.md's gap
// table. Mechanically correct per the supabase-js docs; untestable here
// because this sandbox has no real Supabase credentials.
const resetPasswordSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  newPassword: z.string().min(8),
});

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { accessToken, refreshToken, newPassword } = resetPasswordSchema.parse(body);

    if (!supabaseConfigured) {
      throw new AppError(503, "Password reset requires a configured Supabase project.");
    }

    // A short-lived, anon-key client scoped to the caller's recovery
    // session — not the service-role admin client, since this operation is
    // "act as the user whose recovery link this is," not an admin action.
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      throw new AppError(401, "Invalid or expired password reset link.");
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      throw new AppError(400, updateError.message);
    }

    return NextResponse.json({ ok: true });
  },
  { rateLimit: { limit: 10, windowMs: 10 * 60_000 } }
);
