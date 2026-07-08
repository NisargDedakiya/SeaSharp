import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { searchHsCodes } from "@/core/search/hscodes";

// With no ?q=, returns the full reference list (unchanged legacy behavior).
// With ?q=, delegates to the same full-text search used by GET /api/search
// (type=hscodes) so there's a single implementation of HS code search.
export const GET = withApiHandler(async (request: Request) => {
  const q = new URL(request.url).searchParams.get("q");
  if (q) {
    const results = await searchHsCodes(q);
    return NextResponse.json(results);
  }

  const codes = await serviceDb.query.hsCodes.findMany({ orderBy: (h, { asc }) => [asc(h.code)] });
  return NextResponse.json(codes);
});
