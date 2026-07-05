import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const hsCodes = await prisma.hsCode.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json(hsCodes);
}
