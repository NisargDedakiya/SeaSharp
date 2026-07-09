import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Local file-storage stand-in for Supabase Storage
//
// docs/README.md's gap table documents that Supabase Storage is target-only
// in this codebase: no file upload mechanism exists anywhere in the app, and
// this sandbox has no real Supabase project credentials (same constraint as
// src/core/identity/adapter.ts's Supabase Auth migration — see that file's
// header comment for the established pattern this module follows).
//
// This module is a minimal local-disk stand-in, scoped only to the
// verification (KYC/KYB) feature's document uploads: it writes the given
// buffer to a gitignored `.uploads/` directory at the repo root and returns
// a `storagePath` in exactly the shape `uploadedFiles.storagePath` /
// `documents.storagePath` already expect (a opaque string identifying where
// the file lives). Swapping to real Supabase Storage later means replacing
// this module's internals (uploading to a Supabase Storage bucket and
// returning its object path/URL) while keeping `saveLocalFile`'s signature
// and return shape unchanged — exactly like adapter.ts did for auth.
//
// Not a general-purpose storage integration: no signed URLs, no bucket
// policies, no CDN — just enough to give the verification flow a real,
// working (if locally-scoped) upload path instead of no upload path at all.
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
