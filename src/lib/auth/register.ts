import "server-only";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { authUsers, profiles, organizations, roles, organizationMembers } from "@/db/schema";
import type { OrganizationType } from "@/lib/organizations";
import { AppError } from "@/lib/api-handler";

/**
 * The full registration flow: create the auth identity, its profile, and a
 * brand-new organization it owns — all in one transaction, so a failure
 * partway through never leaves an orphaned auth.users row with no profile
 * or organization. This is what src/app/api/auth/register/route.ts calls.
 */
export async function registerUserAndOrganization(params: {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  organizationType: OrganizationType;
  country?: string;
}): Promise<{ userId: string; email: string; organizationId: string }> {
  const email = params.email.toLowerCase().trim();

  return serviceDb.transaction(async (tx) => {
    const existing = await tx.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
    if (existing) {
      throw new AppError(409, "An account with that email already exists.");
    }

    const encryptedPassword = await bcrypt.hash(params.password, 10);
    const [user] = await tx
      .insert(authUsers)
      .values({ email, encryptedPassword, emailConfirmedAt: new Date() })
      .returning({ id: authUsers.id, email: authUsers.email });

    await tx.insert(profiles).values({ id: user.id, fullName: params.fullName });

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
      profileId: user.id,
      roleId: ownerRole.id,
    });

    return { userId: user.id, email: user.email, organizationId: org.id };
  });
}
