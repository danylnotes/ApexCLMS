import type { AuthTokenType } from "@prisma/client";
import { prisma } from "../db";
import { AppError, invalid } from "../errors";
import { hashPassword, hashToken, newToken, passwordPolicyErrors, verifyPassword } from "../auth/crypto";
import { rateLimit } from "../rate-limit";
import { audit } from "../audit";
import { sendEmail } from "../email";
import { loadSettingsUncached } from "../settings";
import { revokeAllSessions } from "../auth/session";

const GENERIC_FAILURE = "The email address or password is incorrect.";
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hashPassword("timing-equalisation-only"));

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string; code?: "UNVERIFIED" | "LOCKED" };

/** Verifies credentials with rate limiting, lockout and constant-shape error messages. */
export async function authenticate(emailRaw: string, password: string, ip: string | null): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const settings = await loadSettingsUncached();
  const [byEmail, byIp] = await Promise.all([rateLimit(`login:email:${email}`, 10, 900), rateLimit(`login:ip:${ip ?? "unknown"}`, 40, 900)]);
  if (!byEmail.ok || !byIp.ok) return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes and try again." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Equalise timing with a dummy comparison to reduce account enumeration.
    await verifyPassword(password, await dummy());
    return { ok: false, error: GENERIC_FAILURE };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, code: "LOCKED", error: "This account is temporarily locked after repeated failed attempts. Try again later or reset your password." };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= settings.security.maxFailedLogins;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + settings.security.lockoutMinutes * 60_000) : null },
    });
    if (lock) await audit(user.id, "auth.lockout", "user", user.id, undefined, prisma, ip);
    return { ok: false, error: GENERIC_FAILURE };
  }
  if (user.status !== "ACTIVE") return { ok: false, error: user.status === "INVITED" ? "Activate your account using the invitation link sent to your email." : "This account has been deactivated. Contact your administrator." };
  if (!user.emailVerifiedAt) return { ok: false, code: "UNVERIFIED", error: "Verify your email address before signing in." };
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(user.id, "auth.login", "user", user.id, undefined, prisma, ip);
  return { ok: true, userId: user.id };
}

async function issueToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
  const token = newToken();
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); // invalidate earlier tokens
  await prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

/** Always succeeds from the caller's perspective, so it cannot be used to discover accounts. */
export async function requestPasswordReset(emailRaw: string, ip: string | null) {
  const email = emailRaw.trim().toLowerCase();
  const rl = await rateLimit(`reset:${email}:${ip ?? ""}`, 3, 3600);
  if (!rl.ok) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return;
  const token = await issueToken(user.id, "PASSWORD_RESET", 60);
  await sendEmail(user.email, "Reset your password", `A password reset was requested for your account.\n\nReset link (valid for 60 minutes): ${process.env.APP_URL ?? ""}/reset-password?token=${token}\n\nIf you did not request this, you can ignore this message.`);
  await audit(user.id, "auth.reset.requested", "user", user.id, undefined, prisma, ip);
}

async function consumeToken(token: string, types: AuthTokenType[]) {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || !types.includes(row.type) || row.usedAt || row.expiresAt < new Date()) throw invalid("This link is invalid or has expired. Request a new one.");
  return row;
}

export async function peekToken(token: string, types: AuthTokenType[]) {
  try {
    const row = await consumeToken(token, types);
    return { valid: true as const, type: row.type, email: row.user.email, name: row.user.name };
  } catch {
    return { valid: false as const };
  }
}

/** Sets a new password from a reset or invitation token, then revokes all existing sessions. */
export async function setPasswordWithToken(token: string, password: string, confirm: string) {
  if (password !== confirm) throw invalid("The passwords do not match.");
  const errs = passwordPolicyErrors(password);
  if (errs.length) throw invalid(`Your password must contain ${errs.join(", ")}.`);
  const row = await consumeToken(token, ["PASSWORD_RESET", "INVITATION"]);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, ...(row.type === "INVITATION" ? { status: "ACTIVE", emailVerifiedAt: new Date() } : {}) },
    }),
  ]);
  await revokeAllSessions(row.userId);
  await audit(row.userId, row.type === "INVITATION" ? "auth.invitation.accepted" : "auth.reset.completed", "user", row.userId);
  return row.type;
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, ["EMAIL_VERIFICATION"]);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await audit(row.userId, "auth.email.verified", "user", row.userId);
}

export async function sendVerification(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const rl = await rateLimit(`verify:${email}`, 3, 3600);
  if (!rl.ok) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt || user.status !== "ACTIVE") return;
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * 60);
  await sendEmail(user.email, "Verify your email address", `Confirm your email address: ${process.env.APP_URL ?? ""}/verify?token=${token}`);
}

export async function sendInvitation(userId: string, invitedById: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.status === "ACTIVE") throw new AppError("CONFLICT", "This user has already activated their account.");
  const token = await issueToken(user.id, "INVITATION", 7 * 24 * 60);
  await sendEmail(user.email, "You have been invited to the learning platform", `Hello ${user.name},\n\nActivate your account and set a password (link valid for 7 days): ${process.env.APP_URL ?? ""}/verify?token=${token}`);
  await audit(invitedById, "user.invite", "user", user.id);
  return token;
}

export async function changePassword(userId: string, current: string, next: string, confirm: string, keepSessionId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) throw invalid("Your current password is incorrect.");
  if (next !== confirm) throw invalid("The new passwords do not match.");
  const errs = passwordPolicyErrors(next);
  if (errs.length) throw invalid(`Your password must contain ${errs.join(", ")}.`);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await revokeAllSessions(userId, keepSessionId);
  await audit(userId, "auth.password.changed", "user", userId);
}
