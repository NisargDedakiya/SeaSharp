import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { serviceDb } from "@/db/client";
import { organizations, profiles } from "@/db/schema";
import { runSupplierCheck } from "@/core/ai/compliance-ai";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { getSessionActor } from "@/core/identity/session";
import { emit } from "@/core/events";

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

  await emit({
    type: kycStatus === "VERIFIED" ? "KYC_VERIFIED" : "KYC_PENDING",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: { kycStatus, flags: check.flags, recipientProfileIds: [actor.user.id] },
  });

  return NextResponse.json({ kycStatus, flags: check.flags });
});
