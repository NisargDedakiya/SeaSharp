import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateAndSaveSts } from "@/lib/sts";

// Advances escrow to the next pending milestone. Funds only move at
// verified logistics milestones (spec section 05, Pillar B) — this endpoint
// is the only path that can progress an escrow, and it is gated to the two
// counterparties on the deal.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const escrow = await prisma.escrow.findUnique({
    where: { id: params.id },
    include: { milestones: { orderBy: { sequence: "asc" } }, rfq: { include: { shipment: true } } },
  });
  if (!escrow) {
    return NextResponse.json({ error: "Escrow not found." }, { status: 404 });
  }

  const isParticipant =
    escrow.rfq.importerId === session.user.id ||
    escrow.rfq.shipment?.exporterId === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Not a participant on this trade." }, { status: 403 });
  }

  const nextMilestone = escrow.milestones.find((m) => m.status === "PENDING");
  if (!nextMilestone) {
    return NextResponse.json({ error: "All milestones are already complete." }, { status: 409 });
  }

  const isFinalMilestone = nextMilestone.sequence === escrow.milestones.length - 1;
  const isDeliveryMilestone = nextMilestone.sequence === escrow.milestones.length - 2;
  const isCustomsMilestone = nextMilestone.sequence === escrow.milestones.length - 3;

  await prisma.$transaction(async (tx) => {
    await tx.escrowMilestone.update({
      where: { id: nextMilestone.id },
      data: { status: "COMPLETE", completedAt: new Date() },
    });

    if (isCustomsMilestone && escrow.rfq.shipment) {
      await tx.shipment.update({
        where: { id: escrow.rfq.shipment.id },
        data: { transportStage: "CUSTOMS_CLEARANCE", customsClearedAt: new Date() },
      });
    }

    if (isDeliveryMilestone && escrow.rfq.shipment) {
      await tx.shipment.update({
        where: { id: escrow.rfq.shipment.id },
        data: { transportStage: "DELIVERY", deliveredAt: new Date() },
      });
    }

    if (isFinalMilestone) {
      await tx.escrow.update({
        where: { id: escrow.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      if (escrow.rfq.shipment) {
        await tx.shipment.update({
          where: { id: escrow.rfq.shipment.id },
          data: { transportStage: "COMPLETE", status: "COMPLETE" },
        });
        await tx.rfq.update({ where: { id: escrow.rfq.id }, data: { status: "FULFILLED" } });
      }
    } else {
      await tx.escrow.update({ where: { id: escrow.id }, data: { status: "PARTIALLY_RELEASED" } });
    }
  });

  if (isFinalMilestone && escrow.rfq.shipment) {
    await recalculateAndSaveSts(escrow.rfq.shipment.exporterId);
  }

  const updated = await prisma.escrow.findUnique({
    where: { id: escrow.id },
    include: { milestones: { orderBy: { sequence: "asc" } } },
  });

  return NextResponse.json(updated);
}
