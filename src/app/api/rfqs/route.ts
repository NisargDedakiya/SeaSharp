import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { rfqs } from "@/db/schema";
import { listOpenRfqs } from "@/lib/rfqs";
import { getSessionActor } from "@/lib/session";

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
  const rfqList = await listOpenRfqs();
  return NextResponse.json(rfqList);
});

export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor || actor.organization.type !== "IMPORTER") {
    throw new AppError(403, "Only importers can post RFQs.");
  }

  const body = await request.json();
  const data = createRfqSchema.parse(body);

  const [rfq] = await serviceDb
    .insert(rfqs)
    .values({
      ...data,
      volume: data.volume.toString(),
      targetPricePerUnit: data.targetPricePerUnit.toString(),
      organizationId: actor.organization.id,
    })
    .returning();

  return NextResponse.json(
    {
      ...rfq,
      volume: Number(rfq.volume),
      targetPricePerUnit: Number(rfq.targetPricePerUnit),
    },
    { status: 201 }
  );
});
