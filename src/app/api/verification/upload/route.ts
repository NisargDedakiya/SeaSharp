import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { uploadedFiles } from "@/db/schema";
import { saveLocalFile } from "@/core/storage/local-storage";

// Accepts one file per call via multipart/form-data — used twice by the
// /verification form (once for the registration document, once for the tax
// document) before the main /api/verification/submit call, so the submit
// payload only ever carries file IDs, never raw bytes.
const documentKindSchema = z.enum(["REGISTRATION", "TAX"]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");

  const formData = await request.formData();
  const documentKind = documentKindSchema.parse(formData.get("documentKind"));
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppError(400, "A file is required.");
  }
  if (file.size === 0) {
    throw new AppError(400, "File is empty.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError(400, "File exceeds the 10MB upload limit.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveLocalFile({
    organizationId: actor.organization.id,
    fileName: file.name || `${documentKind.toLowerCase()}-document`,
    mimeType: file.type || null,
    buffer,
  });

  const [row] = await serviceDb
    .insert(uploadedFiles)
    .values({
      organizationId: actor.organization.id,
      uploadedBy: actor.user.id,
      storagePath: saved.storagePath,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
    })
    .returning();

  return NextResponse.json({ id: row.id, fileName: row.fileName }, { status: 201 });
});
