import { NextResponse } from "next/server";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor, requireRole, TEAM_INTEGRATIONS_ROLES } from "@/core/identity/session";
import { revokeApiKey } from "@/core/api-platform/keys";

export const DELETE = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");
  requireRole(actor, TEAM_INTEGRATIONS_ROLES);

  await revokeApiKey(actor.organization.id, params.id);
  return NextResponse.json({ ok: true });
});
