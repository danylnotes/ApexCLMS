"use server";

import { redirect } from "next/navigation";
import { authenticate, requestPasswordReset, sendVerification, setPasswordWithToken } from "@/server/services/auth";
import { clearSessionCookie, createSession, getActor, requestMeta, revokeSession, setSessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { runAction, str } from "@/server/action";
import type { ActionState } from "@/lib/action-state";

function safeNext(n: string) {
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/dashboard";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { ok: false, error: "Enter your email address and password." };
  const meta = await requestMeta();
  const r = await authenticate(email, password, meta.ip);
  if (!r.ok) return { ok: false, error: r.error, data: r.code ? { code: r.code } : undefined };
  const { token, expiresAt } = await createSession(r.userId, meta);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(str(fd, "next")));
}

export async function logoutAction() {
  const actor = await getActor();
  if (actor) {
    await revokeSession(actor.sessionId);
    await audit(actor.id, "auth.logout", "user", actor.id);
  }
  await clearSessionCookie();
  redirect("/login?signedOut=1");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const meta = await requestMeta();
  await requestPasswordReset(email, meta.ip);
  return { ok: true, message: "If an active account exists for that address, a reset link has been sent. The link is valid for 60 minutes." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let type: string | undefined;
  const res = await runAction(async () => {
    type = await setPasswordWithToken(str(fd, "token"), str(fd, "password"), str(fd, "confirm"));
  });
  if (!res.ok) return res;
  redirect(type === "INVITATION" ? "/login?activated=1" : "/login?reset=1");
}

export async function resendVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await sendVerification(str(fd, "email"));
  return { ok: true, message: "If the address needs verification, a new link has been sent." };
}
