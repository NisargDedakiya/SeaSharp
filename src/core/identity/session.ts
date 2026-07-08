import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { profiles, organizationMembers, organizations, roles } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/core/identity/adapter";
import { validateApiKey } from "@/core/api-platform/keys";

export type SessionUser = { id: string; email: string; fullName: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const profile = await serviceDb.query.profiles.findFirst({ where: eq(profiles.id, claims.sub) });
  if (!profile) return null;

  return { id: profile.id, email: claims.email, fullName: profile.fullName };
}

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  kycStatus: string;
  stsScore: number;
  roleName: string;
};

// A profile can belong to multiple organizations (see docs/01-product-vision.md);
// Phase 1's registration flow creates exactly one per user, so "current
// organization" for now is simply the first (oldest) one they belong to.
// Multi-org switching is a v2.0 follow-up, not needed until invitations ship.
export async function getCurrentOrganization(profileId: string): Promise<CurrentOrganization | null> {
  const membership = await serviceDb.query.organizationMembers.findFirst({
    where: eq(organizationMembers.profileId, profileId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
  if (!membership) return null;

  const org = await serviceDb.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });
  if (!org) return null;

  const role = await serviceDb.query.roles.findFirst({ where: eq(roles.id, membership.roleId) });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
    kycStatus: org.kycStatus,
    stsScore: org.stsScore,
    roleName: role?.name ?? "Member",
  };
}

export type AuthenticatedActor = { user: SessionUser; organization: CurrentOrganization };

// Convenience for API routes that need both identity and org/role in one
// call — most Marketplace/Finance routes gate on organization.type (the
// v2.0 equivalent of Phase 1's User.role).
export async function getSessionActor(): Promise<AuthenticatedActor | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const organization = await getCurrentOrganization(user.id);
  if (!organization) return null;
  return { user, organization };
}

// Task 6's Public API Platform: the same "who is this" shape
// (`organization`, optionally `user`) resolved from either a session cookie
// OR a bearer API key, so a route written against this can be called by
// the first-party web app (cookie) or a server-to-server integrator (`Authorization:
// Bearer sk_live_...`) without branching on which one was used.
//
// Resolution order (documented, not incidental): if an `Authorization:
// Bearer` header is present, it is tried FIRST as an API key; only when
// there's no such header (or the header's token doesn't validate as a live
// API key) do we fall back to the session cookie. Rationale: server-to-server
// callers only ever send a bearer header, never a browser session cookie,
// so trying the header first avoids an extra no-op cookie lookup on every
// API-key call, and a request that sends both is the unusual case (e.g. a
// developer testing with curl -b) where "the explicit credential wins" is
// the least surprising behavior.
export type RequestActor = {
  organization: CurrentOrganization;
  user: SessionUser | null;
  apiKey?: { id: string; scopes: string[] };
};

export async function getRequestActor(request: Request): Promise<RequestActor | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const apiKeyCtx = await validateApiKey(token);
    if (apiKeyCtx) {
      const org = await serviceDb.query.organizations.findFirst({
        where: eq(organizations.id, apiKeyCtx.organizationId),
      });
      if (!org) return null;
      return {
        user: null,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          kycStatus: org.kycStatus,
          stsScore: org.stsScore,
          roleName: "API_KEY",
        },
        apiKey: { id: apiKeyCtx.apiKeyId, scopes: apiKeyCtx.scopes },
      };
    }
    // Bearer token present but not a valid live API key — fall through to
    // the session cookie rather than immediately failing, since a request
    // could (unusually) carry a stale/garbage Authorization header while
    // still relying on its cookie.
  }

  return getSessionActor();
}
