import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Local disk file storage — scoped only to the verification (KYC/KYB)
// feature's document uploads. Writes the given buffer to a gitignored
// `.uploads/` directory at the repo root and returns a `storagePath` in
// exactly the shape `uploadedFiles.storagePath` / `documents.storagePath`
// already expect (an opaque string identifying where the file lives).
//
// Not a general-purpose storage integration: no signed URLs, no bucket
// policies, no CDN — just enough to give the verification flow a real,
// working upload path.
// ---------------------------------------------------------------------------

const UPLOAD_ROOT = path.join(process.cwd(), ".uploads");

export type SavedLocalFile = {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  size: number;
};

// Sanitizes a user-supplied filename to a safe path segment — strips
// directory separators and anything that isn't alphanumeric/dot/dash/underscore.
function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).trim() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

// Writes `buffer` under `.uploads/<organizationId>/`, named
// `<uuid>-<sanitized-filename>`, and returns the storagePath in the
// `local://<relative-path>` shape uploadedFiles/documents expect.
export async function saveLocalFile(params: {
  organizationId: string;
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
}): Promise<SavedLocalFile> {
  const safeName = sanitizeFileName(params.fileName);
  const orgDir = path.join(UPLOAD_ROOT, params.organizationId);
  await mkdir(orgDir, { recursive: true });

  const storedName = `${randomUUID()}-${safeName}`;
  const absolutePath = path.join(orgDir, storedName);
  await writeFile(absolutePath, params.buffer);

  const relativePath = path.posix.join(".uploads", params.organizationId, storedName);
  return {
    storagePath: `local://${relativePath}`,
    fileName: params.fileName,
    mimeType: params.mimeType,
    size: params.buffer.length,
  };
}
