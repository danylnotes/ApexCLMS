import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { hashToken, newToken } from "./crypto";
import { loadSettingsUncached } from "../settings";
import type { Permission } from "../permissions";
import { AppError } from "../errors";

export const SESSION_COOKIE = "apex_session";

export interface Actor {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: Set<Permission>;
  isDemo: boolean;
  sessionId: string;
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const { security } = await loadSettingsUncached();
  const token = newToken();
  const expiresAt = new Date(Date.now() + security.sessionTtlHours * 3_600_000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionState = { actor: Actor } | { actor: null; reason: "none" | "expired" | "revoked" };

/** Resolves a session token into an actor with permissions loaded from the database. */
export async function resolveSession(token: string | undefined): Promise<SessionState> {
  if (!token) return { actor: null, reason: "none" };
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } },
    },
  });
  if (!session) return { actor: null, reason: "none" };
  if (session.revokedAt || session.user.status !== "ACTIVE") return { actor: null, reason: "revoked" };
  const { security } = await loadSettingsUncached();
  const now = Date.now();
  if (session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > security.sessionIdleMinutes * 60_000) {
    return { actor: null, reason: "expired" };
  }
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }
  const permissions = new Set<Permission>();
  for (const ur of session.user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key as Permission);
  return {
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roles: session.user.roles.map((r) => r.role.key),
      permissions,
      isDemo: session.user.isDemo,
      sessionId: session.id,
    },
  };
}

export const getSessionState = cache(async (): Promise<SessionState> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSession(token);
});

export async function getActor(): Promise<Actor | null> {
  return (await getSessionState()).actor;
}

/** For pages: redirects unauthenticated users to the login or session-expired page. */
export async function requireActor(): Promise<Actor> {
  const s = await getSessionState();
  if (s.actor) return s.actor;
  if (s.reason === "expired") redirect("/session-expired");
  redirect("/login");
}

/** For pages: requires a permission, otherwise shows Access Denied. */
export async function requirePagePermission(...anyOf: Permission[]): Promise<Actor> {
  const actor = await requireActor();
  if (!anyOf.some((p) => actor.permissions.has(p))) redirect("/access-denied");
  return actor;
}

/** For server actions and API handlers: throws instead of redirecting. */
export async function requireActorOrThrow(): Promise<Actor> {
  const s = await getSessionState();
  if (!s.actor) throw new AppError("UNAUTHENTICATED", s.reason === "expired" ? "Your session has expired." : "Sign in required.");
  return s.actor;
}

export async function requestMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, userAgent: h.get("user-agent") };
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
