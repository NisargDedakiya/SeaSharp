import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor, requireRole, TEAM_INTEGRATIONS_ROLES } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { webhookEndpoints } from "@/db/schema";
import { EVENT_TYPES } from "@/core/events/types";

// Management of an organization's own webhook subscriptions — session-cookie
// auth only, same as /api/api-keys. See docs/06-api-integration-spec.md for
// the delivery contract (signature header, at-most-once-per-attempt MVP
// scope).
const createEndpointSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.enum(EVENT_TYPES)).min(1),
});

export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");
  requireRole(actor, TEAM_INTEGRATIONS_ROLES);

  const endpoints = await serviceDb.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.organizationId, actor.organization.id),
  });

  // Secret is never returned after creation.
  return NextResponse.json(
    endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      eventTypes: e.eventTypes,
      createdAt: e.createdAt,
      revokedAt: e.revokedAt,
    }))
  );
});

export const POST = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "Sign in required.");
  requireRole(actor, TEAM_INTEGRATIONS_ROLES);

  const body = await request.json();
  const { url, eventTypes } = createEndpointSchema.parse(body);

  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;

  const [endpoint] = await serviceDb
    .insert(webhookEndpoints)
    .values({ organizationId: actor.organization.id, url, eventTypes, secret })
    .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url, eventTypes: webhookEndpoints.eventTypes });

  // The only time the signing secret is ever returned — the integrator must
  // store it now to verify the X-SeaSharp-Signature header on deliveries.
  return NextResponse.json({ ...endpoint, secret }, { status: 201 });
});
