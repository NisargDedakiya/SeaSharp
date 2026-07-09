import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor, requireRole, TEAM_INTEGRATIONS_ROLES } from "@/core/identity/session";
import { issueApiKey, listApiKeys } from "@/core/api-platform/keys";

// Management of an organization's own API keys — session-cookie auth only
// (an org admin managing their own integration config), never itself
// reachable via a bearer API key. See docs/06-api-integration-spec.md.
const createKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string()).default([]),
});

export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");
  requireRole(actor, TEAM_INTEGRATIONS_ROLES);

  const keys = await listApiKeys(actor.organization.id);
  return NextResponse.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
    }))
  );
});

export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");
  requireRole(actor, TEAM_INTEGRATIONS_ROLES);

  const body = await request.json();
  const { name, scopes } = createKeySchema.parse(body);

  const issued = await issueApiKey({
    organizationId: actor.organization.id,
    createdByProfileId: actor.user.id,
    name,
    scopes,
  });

  // The only time the plaintext key is ever returned — callers must copy
  // it now, it cannot be recovered from the API afterward.
  return NextResponse.json(
    { id: issued.id, keyPrefix: issued.keyPrefix, key: issued.plaintextKey },
    { status: 201 }
  );
});
