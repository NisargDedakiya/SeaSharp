import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";

export const GET = withApiHandler(async () => {
  const codes = await serviceDb.query.hsCodes.findMany({ orderBy: (h, { asc }) => [asc(h.code)] });
  return NextResponse.json(codes);
});
