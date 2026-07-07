import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { organizationMembers, type organizationTypeEnum } from "@/db/schema";

export type OrganizationType = (typeof organizationTypeEnum.enumValues)[number];

// Used to resolve who should receive a notification for an event scoped to
// an organization (e.g. "your bid was awarded") — see
// src/core/events/subscribers.ts's recipientProfileIds convention.
export async function getOrganizationMemberProfileIds(organizationId: string): Promise<string[]> {
  const members = await serviceDb
    .select({ profileId: organizationMembers.profileId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
  return members.map((m) => m.profileId);
}
