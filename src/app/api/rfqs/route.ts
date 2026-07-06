import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { Rfq } from "@/models";
import { listOpenRfqs } from "@/lib/rfqs";
import { serialize } from "@/lib/serialize";

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

export const GET = withApiHandler(async () => {
  const rfqs = await listOpenRfqs();
  return NextResponse.json(serialize(rfqs));
});

export const POST = withApiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "IMPORTER") {
    throw new AppError(403, "Only importers can post RFQs.");
  }

  const body = await request.json();
  const data = createRfqSchema.parse(body);

  const rfq = await Rfq.create({ ...data, importerId: session.user.id });

  return NextResponse.json(serialize(rfq), { status: 201 });
});
