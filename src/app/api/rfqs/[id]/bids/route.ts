import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bidSchema = z.object({
  pricePerUnit: z.coerce.number().positive(),
  message: z.string().max(1000).optional(),
});

// BidSense stub: a real model would rank historical winning bids by product,
// season, and volume. Until that training data exists, suggest a price just
// under the buyer's stated target — directionally useful, cheap to compute.
function suggestBidPrice(targetPricePerUnit: number) {
  return Math.round(targetPricePerUnit * 0.97 * 100) / 100;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "EXPORTER") {
    return NextResponse.json({ error: "Only exporters can submit bids." }, { status: 403 });
  }

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }
  if (rfq.status !== "OPEN") {
    return NextResponse.json({ error: "This RFQ is no longer accepting bids." }, { status: 409 });
  }
  if (new Date() > rfq.deadline) {
    return NextResponse.json({ error: "The bidding deadline has passed." }, { status: 409 });
  }

  const body = await request.json();
  const parsed = bidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const aiSuggestedPrice = suggestBidPrice(rfq.targetPricePerUnit);

  const bid = await prisma.bid.upsert({
    where: { rfqId_exporterId: { rfqId: rfq.id, exporterId: session.user.id } },
    update: { pricePerUnit: parsed.data.pricePerUnit, message: parsed.data.message },
    create: {
      rfqId: rfq.id,
      exporterId: session.user.id,
      pricePerUnit: parsed.data.pricePerUnit,
      message: parsed.data.message,
      aiSuggestedPrice,
    },
  });

  return NextResponse.json(bid, { status: 201 });
}
