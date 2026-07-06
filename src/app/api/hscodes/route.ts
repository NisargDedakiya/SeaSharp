import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { HsCode } from "@/models";

export const GET = withApiHandler(async () => {
  const hsCodes = await HsCode.find().sort({ _id: 1 });
  return NextResponse.json(
    hsCodes.map((hs) => ({ code: hs._id, description: hs.description, category: hs.category }))
  );
});
