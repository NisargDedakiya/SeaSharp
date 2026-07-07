import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { organizations, profiles } from "@/db/schema";
import { runSupplierCheck } from "@/lib/supplierradar";
import { recalculateAndSaveSts } from "@/lib/sts-server";
import { getSessionActor } from "@/lib/session";

export const POST = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const [org, profile] = await Promise.all([
    serviceDb.query.organizations.findFirst({ where: eq(organizations.id, actor.organization.id) }),
    serviceDb.query.profiles.findFirst({ where: eq(profiles.id, actor.user.id) }),
  ]);
  if (!org) throw new AppError(404, "Organization not found.");

  const check = runSupplierCheck({
    companyName: org.name,
    country: org.country,
    phone: profile?.phone ?? null,
  });

  const kycStatus = check.cleared ? "VERIFIED" : "PENDING";
  await serviceDb.update(organizations).set({ kycStatus }).where(eq(organizations.id, org.id));

  if (actor.organization.type === "EXPORTER") {
    await recalculateAndSaveSts(actor.organization.id);
  }

  return NextResponse.json({ kycStatus, flags: check.flags });
});
