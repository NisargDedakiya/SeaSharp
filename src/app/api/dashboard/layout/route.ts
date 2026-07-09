import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { getSessionActor } from "@/core/identity/session";
import { serviceDb } from "@/db/client";
import { dashboardLayouts } from "@/db/schema";
import { WIDGET_TYPES, defaultLayoutFor, type OrganizationType } from "@/components/dashboard/widgets/registry";

const layoutSchema = z.object({
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.enum(WIDGET_TYPES),
      visible: z.boolean(),
      order: z.number().int(),
    })
  ),
});

// One row per profile+organization (dashboard_layouts, same shape as
// notification_preferences) — GET returns the saved layout or the
// org-type default if the profile hasn't customized one yet, PATCH
// upserts the full widget list. Following the withApiHandler/getSessionActor
// pattern every other route in src/app/api uses.
export const GET = withApiHandler(async () => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const existing = await serviceDb.query.dashboardLayouts.findFirst({
    where: and(eq(dashboardLayouts.profileId, actor.user.id), eq(dashboardLayouts.organizationId, actor.organization.id)),
  });

  return NextResponse.json({
    widgets: existing?.widgets ?? defaultLayoutFor(actor.organization.type as OrganizationType),
  });
});

export const PATCH = withApiHandler(async (request: Request) => {
  const actor = await getSessionActor();
  if (!actor) {
    throw new AppError(401, "Sign in required.");
  }

  const body = await request.json();
  const { widgets } = layoutSchema.parse(body);

  const [layout] = await serviceDb
    .insert(dashboardLayouts)
    .values({
      profileId: actor.user.id,
      organizationId: actor.organization.id,
      widgets,
    })
    .onConflictDoUpdate({
      target: [dashboardLayouts.profileId, dashboardLayouts.organizationId],
      set: { widgets, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ widgets: layout.widgets });
});
