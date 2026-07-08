import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { webhookEndpoints } from "@/db/schema";

export const DELETE = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");

  const [row] = await serviceDb
    .update(webhookEndpoints)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(webhookEndpoints.id, params.id),
        eq(webhookEndpoints.organizationId, actor.organization.id),
        isNull(webhookEndpoints.revokedAt)
      )
    )
    .returning({ id: webhookEndpoints.id });

  if (!row) throw new AppError(404, "Webhook endpoint not found.");
  return NextResponse.json({ ok: true });
});
