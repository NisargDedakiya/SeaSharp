import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export function getSessionUser() {
  return getServerSession(authOptions).then((session) => session?.user ?? null);
}
