import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { organizations, kycSubmissions, uploadedFiles } from "@/db/schema";
import { runSupplierCheck } from "@/core/ai/compliance-ai";
import { recalculateAndSaveSts } from "@/core/finance/sts-server";
import { emit } from "@/core/events";

// GET: current org status + submission history, for the /verification page.
export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");

  const org = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, actor.organization.id),
  });
  if (!org) throw new AppError(404, "Organization not found.");

  const submissions = await serviceDb.query.kycSubmissions.findMany({
    where: eq(kycSubmissions.organizationId, actor.organization.id),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  return NextResponse.json({
    kycStatus: org.kycStatus,
    submissions: submissions.map((s) => ({
      id: s.id,
      legalCompanyName: s.legalCompanyName,
      country: s.country,
      status: s.status,
      flags: s.flags,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt,
    })),
  });
});

const beneficialOwnerSchema = z.object({
  name: z.string().min(1),
  ownershipPercent: z.number().min(0).max(100).nullable().optional(),
});

const submitSchema = z.object({
  legalCompanyName: z.string().min(1).max(300),
  registrationNumber: z.string().min(1).max(100),
  taxId: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  beneficialOwners: z.array(beneficialOwnerSchema).min(1),
  registrationDocumentFileId: z.string().uuid().nullable().optional(),
  taxDocumentFileId: z.string().uuid().nullable().optional(),
});

// POST: full KYC/KYB submission. Supersedes the old bare /api/kyc
// (removed) — collects the real fields from docs/02-product-requirements.md
// §1.4, runs SupplierRadar's heuristic check against them, records the
// submission, and mirrors the previous route's status/STS/event side
// effects exactly.
export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");

  const body = await request.json();
  const input = submitSchema.parse(body);

  // Verify any referenced uploaded files belong to this org before linking them.
  const fileIds = [input.registrationDocumentFileId, input.taxDocumentFileId].filter(
    (id): id is string => !!id
  );
  if (fileIds.length > 0) {
    const files = await serviceDb.query.uploadedFiles.findMany({
      where: and(eq(uploadedFiles.organizationId, actor.organization.id)),
    });
    const ownedIds = new Set(files.map((f) => f.id));
    for (const id of fileIds) {
      if (!ownedIds.has(id)) {
        throw new AppError(400, "One or more uploaded documents were not found for this organization.");
      }
    }
  }

  const check = runSupplierCheck({
    legalCompanyName: input.legalCompanyName,
    registrationNumber: input.registrationNumber,
    taxId: input.taxId,
    country: input.country,
    beneficialOwners: input.beneficialOwners,
  });

  const kycStatus = check.cleared ? "VERIFIED" : "PENDING";

  const [submission] = await serviceDb
    .insert(kycSubmissions)
    .values({
      organizationId: actor.organization.id,
      submittedByProfileId: actor.user.id,
      legalCompanyName: input.legalCompanyName,
      registrationNumber: input.registrationNumber,
      taxId: input.taxId,
      country: input.country,
      beneficialOwners: input.beneficialOwners.map((o) => ({
        name: o.name,
        ownershipPercent: o.ownershipPercent ?? null,
      })),
      registrationDocumentFileId: input.registrationDocumentFileId ?? null,
      taxDocumentFileId: input.taxDocumentFileId ?? null,
      status: kycStatus,
      flags: check.flags,
      reviewedAt: new Date(),
    })
    .returning();

  await serviceDb.update(organizations).set({ kycStatus }).where(eq(organizations.id, actor.organization.id));

  if (actor.organization.type === "EXPORTER") {
    await recalculateAndSaveSts(actor.organization.id);
  }

  await emit({
    type: kycStatus === "VERIFIED" ? "KYC_VERIFIED" : "KYC_PENDING",
    organizationId: actor.organization.id,
    actorProfileId: actor.user.id,
    payload: { kycStatus, flags: check.flags, recipientProfileIds: [actor.user.id] },
  });

  return NextResponse.json({
    id: submission.id,
    kycStatus,
    flags: check.flags,
  });
});
