import type { NotificationType } from "@prisma/client";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { loadSettingsUncached } from "./settings";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Unique per user per underlying event; repeated calls with the same key are ignored. */
  dedupeKey: string;
}

/** Creates an in-app notification (respecting preferences) and optionally emails it. Idempotent per dedupeKey. */
export async function notify(userId: string, n: NotifyInput): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId_type: { userId, type: n.type } } });
  const inApp = pref?.inApp ?? true;
  const settings = await loadSettingsUncached();
  const wantsEmail = settings.notifications.emailEnabled && (pref?.email ?? false);
  if (!inApp && !wantsEmail) return false;
  const created = await prisma.notification.createMany({
    data: [{ userId, type: n.type, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey, emailStatus: wantsEmail ? "QUEUED" : "NOT_REQUESTED", readAt: inApp ? null : new Date() }],
    skipDuplicates: true,
  });
  if (created.count === 0) return false;
  if (wantsEmail) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) {
      const msg = await sendEmail(user.email, n.title, `${n.body}\n\n${process.env.APP_URL ?? ""}${n.link ?? ""}`);
      await prisma.notification.update({
        where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
        data: { emailStatus: msg.status === "SENT" ? "SENT" : "QUEUED" },
      });
    }
  }
  return true;
}
