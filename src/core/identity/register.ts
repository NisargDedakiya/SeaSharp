import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { profiles, organizations, roles, organizationMembers } from "@/db/schema";
import type { OrganizationType } from "@/core/identity/organizations";
import { createAuthIdentity, deleteAuthIdentity } from "@/core/identity/adapter";

/**
 * The full registration flow: create the auth identity, then its profile
 * and a brand-new organization it owns in one DB transaction.
 *
 * Historically this ran entirely inside one Postgres transaction, so a
 * failure partway through never left an orphaned `auth.users` row. Now that
 * the auth identity is created via `createAuthIdentity` — which, once a
 * real Supabase project is configured, calls out to Supabase Auth over the
 * network rather than inserting a row in this DB — it can no longer be part
 * of the same Postgres transaction as the profile/organization insert.
 * Instead: create the auth identity first, then run profile+org creation in
 * a transaction, and best-effort compensate (delete the auth identity) if
 * that transaction fails. See adapter.ts's `deleteAuthIdentity` for why this
 * is "best-effort" rather than fully atomic. This is what
 * src/app/api/auth/register/route.ts calls.
 */
export async function registerUserAndOrganization(params: {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  organizationType: OrganizationType;
  country?: string;
}): Promise<{ userId: string; email: string; organizationId: string }> {
  const identity = await createAuthIdentity({
    email: params.email,
    password: params.password,
    fullName: params.fullName,
  });

  try {
    return await registerOrganizationForIdentity(identity, params);
  } catch (err) {
    await deleteAuthIdentity(identity.id);
    throw err;
  }
}

async function registerOrganizationForIdentity(
  identity: { id: string; email: string },
  params: {
    fullName: string;
    organizationName: string;
    organizationType: OrganizationType;
    country?: string;
  }
): Promise<{ userId: string; email: string; organizationId: string }> {
  return serviceDb.transaction(async (tx) => {
    await tx.insert(profiles).values({ id: identity.id, fullName: params.fullName });

    const ownerRole = await tx.query.roles.findFirst({
      where: and(isNull(roles.organizationId), eq(roles.name, "Owner")),
    });
    if (!ownerRole) {
      throw new Error(
        "System 'Owner' role is missing — run drizzle/0002_seed_system_roles.sql before registering users."
      );
    }

    const slugBase = params.organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org";
    const slugTaken = await tx.query.organizations.findFirst({
      where: eq(organizations.slug, slugBase),
    });
    const slug = slugTaken ? `${slugBase}-${Math.random().toString(36).slice(2, 7)}` : slugBase;

    const [org] = await tx
      .insert(organizations)
      .values({
        name: params.organizationName,
        slug,
        type: params.organizationType,
        country: params.country,
      })
      .returning({ id: organizations.id });

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      profileId: identity.id,
      roleId: ownerRole.id,
    });

    return { userId: identity.id, email: identity.email, organizationId: org.id };
  });
}
