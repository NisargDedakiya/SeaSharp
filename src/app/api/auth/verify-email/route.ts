import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { supabaseConfigured } from "@/core/identity/adapter";
import { env } from "@/lib/env";

// Confirms a Supabase Auth "confirm your email" link. The client extracts
// `token_hash` from the confirmation link's query string and posts it here;
// Supabase verifies it and marks the user's email confirmed.
//
// NOT verified against a live Supabase project — see docs/README.md's gap
// table. Mechanically correct per the supabase-js docs; untestable here
// because this sandbox has no real Supabase credentials.
const verifyEmailSchema = z.object({
  tokenHash: z.string().min(1),
});

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { tokenHash } = verifyEmailSchema.parse(body);

    if (!supabaseConfigured) {
      throw new AppError(503, "Email verification requires a configured Supabase project.");
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error) {
      throw new AppError(400, "Invalid or expired verification link.");
    }

    return NextResponse.json({ ok: true });
  },
  { rateLimit: { limit: 20, windowMs: 10 * 60_000 } }
);
