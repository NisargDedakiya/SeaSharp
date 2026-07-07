import "server-only";
import type { organizationTypeEnum } from "@/db/schema";

export type OrganizationType = (typeof organizationTypeEnum.enumValues)[number];
