"use server";

import type { NotificationType } from "@prisma/client";
import { requireActorOrThrow } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { runAction, str } from "@/server/action";
import { changePassword } from "@/server/services/auth";
import { audit } from "@/server/audit";
import { invalid } from "@/server/errors";
import type { ActionState } from "@/lib/action-state";
import { NOTIFICATION_TYPES } from "./types";
import { getI18n } from "@/i18n/server";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActorOrThrow();
    const phone = str(fd, "phone").trim().slice(0, 40) || null;
    const bio = str(fd, "bio").trim().slice(0, 1000) || null;
    await prisma.userProfile.update({ where: { userId: actor.id }, data: { phone, bio } });
    const { t } = await getI18n();
    return t("Profile updated.");
  }, ["/profile"]);
}

export async function preferencesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActorOrThrow();
    for (const t of NOTIFICATION_TYPES) {
      const type = t.type as NotificationType;
      const inApp = fd.get(`inApp_${type}`) === "on";
      const email = fd.get(`email_${type}`) === "on";
      await prisma.notificationPreference.upsert({ where: { userId_type: { userId: actor.id, type } }, create: { userId: actor.id, type, inApp, email }, update: { inApp, email } });
    }
    const { t } = await getI18n();
    return t("Notification preferences saved.");
  }, ["/profile"]);
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActorOrThrow();
    await changePassword(actor.id, str(fd, "current"), str(fd, "next"), str(fd, "confirm"), actor.sessionId);
    const { t } = await getI18n();
    return t("Password changed. Your other sessions have been signed out.");
  });
}

export async function revokeSessionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActorOrThrow();
    const { t } = await getI18n();
    const id = str(fd, "sessionId");
    if (id === actor.sessionId) throw invalid(t("Use Sign out to end the current session."));
    const r = await prisma.session.updateMany({ where: { id, userId: actor.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (r.count) await audit(actor.id, "auth.session.revoke", "session", id);
    return t("Session signed out.");
  }, ["/profile"]);
}
