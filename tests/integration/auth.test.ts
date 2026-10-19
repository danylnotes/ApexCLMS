import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { authenticate, requestPasswordReset, setPasswordWithToken, peekToken } from "@/server/services/auth";
import { createSession, resolveSession } from "@/server/auth/session";
import { hashPassword, hashToken, newToken } from "@/server/auth/crypto";

const PW = "Demo#Apex2026!";

describe("authentication", () => {
  it("accepts valid credentials and records the sign-in", async () => {
    const r = await authenticate("james.okafor@apex-demo.test", PW, "10.0.0.1");
    expect(r.ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "auth.login", actorId: r.ok ? r.userId : "" } })).toBeGreaterThan(0);
  });

  it("returns the same message for unknown accounts and wrong passwords", async () => {
    const a = await authenticate("nobody@apex-demo.test", PW, "10.0.0.2");
    const b = await authenticate("james.okafor@apex-demo.test", "Wrong#Password1", "10.0.0.2");
    expect(a.ok || b.ok).toBe(false);
    expect(!a.ok && !b.ok && a.error === b.error).toBe(true);
  });

  it("locks the account after repeated failures", async () => {
    const email = `lock.${Date.now()}@apex-demo.test`;
    await prisma.user.create({ data: { email, name: "Lock Test", passwordHash: await hashPassword(PW), status: "ACTIVE", emailVerifiedAt: new Date() } });
    for (let i = 0; i < 5; i++) await authenticate(email, "Bad#Password123", `10.1.${i}.1`);
    const r = await authenticate(email, PW, "10.1.9.1");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe("LOCKED");
  });

  it("blocks deactivated and unverified users", async () => {
    const email = `unverified.${Date.now()}@apex-demo.test`;
    await prisma.user.create({ data: { email, name: "U", passwordHash: await hashPassword(PW), status: "ACTIVE" } });
    const r = await authenticate(email, PW, "10.2.0.1");
    expect(!r.ok && r.code).toBe("UNVERIFIED");
  });

  it("resolves, expires and revokes sessions server-side", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "lina.saleh@apex-demo.test" } });
    const { token } = await createSession(u.id, { ip: null, userAgent: "vitest" });
    const ok = await resolveSession(token);
    expect(ok.actor?.id).toBe(u.id);
    expect(ok.actor?.permissions.has("learning.self")).toBe(true);
    await prisma.session.update({ where: { tokenHash: hashToken(token) }, data: { lastSeenAt: new Date(Date.now() - 3 * 3_600_000) } });
    expect((await resolveSession(token)).actor).toBeNull();
    const { token: t2 } = await createSession(u.id, { ip: null, userAgent: "vitest" });
    await prisma.session.update({ where: { tokenHash: hashToken(t2) }, data: { revokedAt: new Date() } });
    const r = await resolveSession(t2);
    expect(r.actor).toBeNull();
    expect(r.actor === null && r.reason).toBe("revoked");
    expect((await resolveSession(newToken())).actor).toBeNull();
  });

  it("completes a password reset with a single-use token and revokes sessions", async () => {
    const email = `reset.${Date.now()}@apex-demo.test`;
    const u = await prisma.user.create({ data: { email, name: "Reset", passwordHash: await hashPassword(PW), status: "ACTIVE", emailVerifiedAt: new Date() } });
    const { token: sessionToken } = await createSession(u.id, { ip: null, userAgent: null });
    await requestPasswordReset(email, "10.3.0.1");
    const mail = await prisma.emailOutbox.findFirstOrThrow({ where: { toAddress: email }, orderBy: { createdAt: "desc" } });
    const token = /token=([\w-]+)/.exec(mail.body)![1];
    expect((await peekToken(token, ["PASSWORD_RESET"])).valid).toBe(true);
    await expect(setPasswordWithToken(token, "weak", "weak")).rejects.toThrow(/must contain/);
    await setPasswordWithToken(token, "New-Strong#Pass2026", "New-Strong#Pass2026");
    await expect(setPasswordWithToken(token, "New-Strong#Pass2026", "New-Strong#Pass2026")).rejects.toThrow(/invalid or has expired/);
    expect((await resolveSession(sessionToken)).actor).toBeNull();
    expect((await authenticate(email, "New-Strong#Pass2026", "10.3.0.2")).ok).toBe(true);
  });
});
