import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, and, isNull } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { authUsers, profiles, organizations, roles, organizationMembers } from "@/db/schema";

// Same mocking approach as tests/integration/rfq-lifecycle.test.ts:
// getSessionActor() reads a signed cookie via next/headers, which isn't
// meaningful in a direct route-handler-function-call test. roleName is
// included here (unlike that file's MockActor) since these routes gate on
// actor.organization.roleName.
type MockActor = {
  user: { id: string; email: string; fullName: string };
  organization: {
    id: string;
    type: string;
    stsScore: number;
    kycStatus: string;
    roleName: string;
  };
} | null;
let mockActor: MockActor = null;

vi.mock("@/core/identity/session", async () => {
  const actual = await vi.importActual<typeof import("@/core/identity/session")>("@/core/identity/session");
  return {
    ...actual,
    getSessionActor: vi.fn(() => Promise.resolve(mockActor)),
    getSessionUser: vi.fn(() => Promise.resolve(mockActor?.user ?? null)),
  };
});

import { POST as createApiKey } from "@/app/api/api-keys/route";
import { POST as createWebhookEndpoint } from "@/app/api/webhook-endpoints/route";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Creates one organization plus an Owner and a Member profile inside it,
// returning ready-to-use MockActors for both — the scenario Task 3 needs to
// prove Members are blocked while Owners keep working.
async function seedOrgWithOwnerAndMember() {
  const [org] = await serviceDb
    .insert(organizations)
    .values({ name: "Acme Exports", slug: `acme-${crypto.randomUUID()}`, type: "EXPORTER" })
    .returning({ id: organizations.id, type: organizations.type, stsScore: organizations.stsScore, kycStatus: organizations.kycStatus });

  const ownerRole = await serviceDb.query.roles.findFirst({
    where: and(isNull(roles.organizationId), eq(roles.name, "Owner")),
  });
  const memberRole = await serviceDb.query.roles.findFirst({
    where: and(isNull(roles.organizationId), eq(roles.name, "Member")),
  });
  if (!ownerRole || !memberRole) throw new Error("system roles not seeded");

  // profiles.id is a FK into auth.users (see src/db/schema/identity.ts) —
  // a real auth identity has to exist first, same as adapter.ts's local
  // fallback backend does at registration time.
  const [ownerAuthUser, memberAuthUser] = await serviceDb
    .insert(authUsers)
    .values([
      { email: `owner-${crypto.randomUUID()}@test.com`, encryptedPassword: "not-a-real-hash" },
      { email: `member-${crypto.randomUUID()}@test.com`, encryptedPassword: "not-a-real-hash" },
    ])
    .returning({ id: authUsers.id });
  const ownerProfileId = ownerAuthUser.id;
  const memberProfileId = memberAuthUser.id;
  await serviceDb.insert(profiles).values([
    { id: ownerProfileId, fullName: "Org Owner" },
    { id: memberProfileId, fullName: "Org Member" },
  ]);
  await serviceDb.insert(organizationMembers).values([
    { organizationId: org.id, profileId: ownerProfileId, roleId: ownerRole.id },
    { organizationId: org.id, profileId: memberProfileId, roleId: memberRole.id },
  ]);

  const orgFields = { id: org.id, type: org.type, stsScore: org.stsScore, kycStatus: org.kycStatus };
  const owner: MockActor = {
    user: { id: ownerProfileId, email: "owner@acme.test", fullName: "Org Owner" },
    organization: { ...orgFields, roleName: "Owner" },
  };
  const member: MockActor = {
    user: { id: memberProfileId, email: "member@acme.test", fullName: "Org Member" },
    organization: { ...orgFields, roleName: "Member" },
  };
  return { owner, member };
}

describe("Team integrations RBAC (API keys / webhook endpoints)", () => {
  beforeEach(() => {
    mockActor = null;
  });

  it("blocks a Member from creating an API key but allows an Owner", async () => {
    const { owner, member } = await seedOrgWithOwnerAndMember();

    mockActor = member;
    const memberRes = await createApiKey(
      jsonRequest("http://localhost/api/api-keys", { name: "member key", scopes: [] }),
      { params: {} }
    );
    expect(memberRes.status).toBe(403);

    mockActor = owner;
    const ownerRes = await createApiKey(
      jsonRequest("http://localhost/api/api-keys", { name: "owner key", scopes: [] }),
      { params: {} }
    );
    expect(ownerRes.status).toBe(201);
  });

  it("blocks a Member from creating a webhook endpoint but allows an Owner", async () => {
    const { owner, member } = await seedOrgWithOwnerAndMember();

    mockActor = member;
    const memberRes = await createWebhookEndpoint(
      jsonRequest("http://localhost/api/webhook-endpoints", {
        url: "https://example.com/hooks/seasharp",
        eventTypes: ["RFQ_CREATED"],
      }),
      { params: {} }
    );
    expect(memberRes.status).toBe(403);

    mockActor = owner;
    const ownerRes = await createWebhookEndpoint(
      jsonRequest("http://localhost/api/webhook-endpoints", {
        url: "https://example.com/hooks/seasharp",
        eventTypes: ["RFQ_CREATED"],
      }),
      { params: {} }
    );
    expect(ownerRes.status).toBe(201);
  });
});
