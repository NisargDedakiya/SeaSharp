import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSupplierCheck } from "@/lib/supplierradar";
import { recalculateAndSaveTns } from "@/lib/tns";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const check = runSupplierCheck({
    companyName: user.companyName,
    country: user.country,
    phone: user.phone,
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      kycStatus: check.cleared ? "VERIFIED" : "PENDING",
      kycSubmittedAt: new Date(),
      kycVerifiedAt: check.cleared ? new Date() : null,
    },
  });

  if (updated.role === "EXPORTER") {
    await recalculateAndSaveTns(updated.id);
  }

  return NextResponse.json({ kycStatus: updated.kycStatus, flags: check.flags });
}
