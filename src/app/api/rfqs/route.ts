import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createRfqSchema = z.object({
  product: z.string().min(2),
  hsCode: z.string().min(2),
  originCountry: z.string().length(2),
  destinationCountry: z.string().length(2),
  volume: z.coerce.number().positive(),
  unit: z.string().min(1),
  targetPricePerUnit: z.coerce.number().positive(),
  currency: z.string().default("USD"),
  deadline: z.coerce.date(),
});

export async function GET() {
  const rfqs = await prisma.rfq.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      importer: { select: { name: true, companyName: true, country: true } },
      _count: { select: { bids: true } },
    },
  });
  return NextResponse.json(rfqs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "IMPORTER") {
    return NextResponse.json({ error: "Only importers can post RFQs." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createRfqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rfq = await prisma.rfq.create({
    data: { ...parsed.data, importerId: session.user.id },
  });

  return NextResponse.json(rfq, { status: 201 });
}
