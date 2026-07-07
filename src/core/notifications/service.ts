import "server-only";
import { eq, and } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { notifications, notificationPreferences, authUsers, profiles } from "@/db/schema";
import { sendEmail } from "@/integrations/resend";
import { sendSms } from "@/integrations/twilio";

// The single place notification logic lives — nothing else should insert
// into the `notifications` table directly or call the resend/twilio
// integrations on its own.
export async function notify(params: {
  profileId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const preferences = await serviceDb.query.notificationPreferences.findMany({
    where: and(
      eq(notificationPreferences.profileId, params.profileId),
      eq(notificationPreferences.notificationType, params.type)
    ),
  });
  const isEnabled = (channel: string) => {
    const pref = preferences.find((p) => p.channel === channel);
    return pref ? pref.enabled : true; // no row = opted in by default
  };

  if (isEnabled("IN_APP")) {
    await serviceDb.insert(notifications).values({
      profileId: params.profileId,
      type: params.type,
      payload: params.payload,
    });
  }

  const summary = `${params.type}: ${JSON.stringify(params.payload)}`;

  if (isEnabled("EMAIL")) {
    const [user] = await serviceDb
      .select({ email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, params.profileId));
    if (user) {
      await sendEmail({ to: user.email, subject: params.type, body: summary });
    }
  }

  if (isEnabled("SMS")) {
    const [profile] = await serviceDb
      .select({ phone: profiles.phone })
      .from(profiles)
      .where(eq(profiles.id, params.profileId));
    if (profile?.phone) {
      await sendSms({ to: profile.phone, body: summary });
    }
  }
}
