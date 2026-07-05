import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Blind bidding: the RFQ owner (importer) sees every bid to decide who to
// award. Exporters only ever see their own bid price plus the total bid
// count — never competitors' prices — so market pricing stays protected
// until the deal is done.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  const rfq = await prisma.rfq.findUnique({
    where: { id: params.id },
    include: {
      importer: { select: { id: true, name: true, companyName: true, country: true } },
      bids: {
        include: { exporter: { select: { id: true, name: true, companyName: true, tnsScore: true } } },
        orderBy: { createdAt: "asc" },
      },
      escrow: { include: { milestones: { orderBy: { sequence: "asc" } } } },
      shipment: true,
    },
  });

  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }

  const isOwner = session?.user?.id === rfq.importerId;
  const viewerId = session?.user?.id;

  const bids = isOwner
    ? rfq.bids
    : rfq.bids
        .filter((bid) => bid.exporterId === viewerId)
        .map((bid) => bid);

  return NextResponse.json({
    ...rfq,
    bids,
    totalBidCount: rfq.bids.length,
  });
}
