import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ESCROW_MILESTONES, recommendRoute } from "@/lib/logistics";

const awardSchema = z.object({ bidId: z.string() });

// Importer awards a bid: locks funds in escrow, rejects the other bids, and
// spins up a Shipment record seeded with a RouteIQ freight recommendation.
// Escrow only ever releases through /api/escrow/[id]/release as milestones
// complete — no single actor can unilaterally move funds (spec section 09).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: { bids: true } });
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }
  if (rfq.importerId !== session.user.id) {
    return NextResponse.json({ error: "Only the RFQ owner can award a bid." }, { status: 403 });
  }
  if (rfq.status !== "OPEN") {
    return NextResponse.json({ error: "This RFQ has already been awarded or closed." }, { status: 409 });
  }

  const body = await request.json();
  const parsed = awardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const winningBid = rfq.bids.find((b) => b.id === parsed.data.bidId);
  if (!winningBid) {
    return NextResponse.json({ error: "Bid not found on this RFQ." }, { status: 404 });
  }

  const exporter = await prisma.user.findUniqueOrThrow({ where: { id: winningBid.exporterId } });
  const escrowAmount = Math.round(winningBid.pricePerUnit * rfq.volume * 100) / 100;
  const route = recommendRoute({
    volume: rfq.volume,
    originLocation: rfq.originCountry,
    destinationLocation: rfq.destinationCountry,
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.rfq.update({
      where: { id: rfq.id },
      data: { status: "AWARDED", awardedBidId: winningBid.id },
    });

    await tx.bid.update({ where: { id: winningBid.id }, data: { status: "ACCEPTED" } });
    await tx.bid.updateMany({
      where: { rfqId: rfq.id, id: { not: winningBid.id } },
      data: { status: "REJECTED" },
    });

    const escrow = await tx.escrow.create({
      data: {
        rfqId: rfq.id,
        amount: escrowAmount,
        currency: rfq.currency,
        status: "FUNDED",
        fundedAt: new Date(),
        milestones: {
          create: ESCROW_MILESTONES.map((name, index) => ({
            name,
            sequence: index,
            status: index === 0 ? "COMPLETE" : "PENDING",
            completedAt: index === 0 ? new Date() : null,
          })),
        },
      },
      include: { milestones: true },
    });

    const shipment = await tx.shipment.create({
      data: {
        rfqId: rfq.id,
        exporterId: winningBid.exporterId,
        importerId: rfq.importerId,
        mode: route.mode,
        originLocation: rfq.originCountry,
        destinationLocation: rfq.destinationCountry,
        estimatedCost: route.estimatedCost,
        tnsScoreAtTimeOfDeal: exporter.tnsScore,
        aiRouteRecommendation: route.recommendation,
      },
    });

    return { escrow, shipment };
  });

  return NextResponse.json(result, { status: 201 });
}
