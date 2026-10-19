import { z } from "zod";
import { prisma } from "../db";
import { conflict, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan } from "../policy";
import { audit } from "../audit";
import { sendInvitation } from "./auth";
import { revokeAllSessions } from "../auth/session";
import { DEFAULT_SETTINGS, type SettingKey } from "../settings";
import { PERMISSIONS, type Permission } from "../permissions";

export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  employeeNumber: z.string().trim().max(30).optional().default(""),
  departmentId: z.string().optional().nullable(),
  jobRoleId: z.string().optional().nullable(),
  targetJobRoleId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  location: z.string().trim().max(120).optional().default(""),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "ON_LEAVE", "SECONDED"]).default("PERMANENT"),
  learningProgramme: z.string().trim().max(200).optional().default(""),
  cpdPolicyId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  roleKeys: z.array(z.string()).default(["EMPLOYEE"]),
});

async function setManager(userId: string, managerId: string | null) {
  if (managerId === userId) throw invalid("A user cannot manage themselves.");
  // Prevent cycles: the new manager must not report (directly or indirectly) to this user.
  if (managerId) {
    let cursor: string | null = managerId;
    for (let i = 0; i < 20 && cursor; i++) {
      const rel: { managerId: string } | null = await prisma.managerRelationship.findFirst({ where: { employeeId: cursor, type: "LINE", endDate: null }, select: { managerId: true } });
      if (rel?.managerId === userId) throw invalid("This would create a circular reporting line.");
      cursor = rel?.managerId ?? null;
    }
  }
  const current = await prisma.managerRelationship.findFirst({ where: { employeeId: userId, type: "LINE", endDate: null } });
  if (current?.managerId === managerId) return;
  if (current) await prisma.managerRelationship.update({ where: { id: current.id }, data: { endDate: new Date() } });
  if (managerId) {
    const old = await prisma.managerRelationship.findUnique({ where: { managerId_employeeId_type: { managerId, employeeId: userId, type: "LINE" } } });
    if (old) await prisma.managerRelationship.update({ where: { id: old.id }, data: { endDate: null, startDate: new Date() } });
    else await prisma.managerRelationship.create({ data: { managerId, employeeId: userId } });
  }
}

async function setRoles(userId: string, keys: string[]) {
  const roles = await prisma.role.findMany({ where: { key: { in: keys.length ? keys : ["EMPLOYEE"] } } });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) });
}

export async function createUser(actor: Actor, raw: unknown, opts: { invite: boolean }) {
  assertCan(actor, "user.manage");
  const u = userSchema.parse(raw);
  if (await prisma.user.findUnique({ where: { email: u.email } })) throw conflict("A user with this email already exists.");
  if (u.employeeNumber && (await prisma.userProfile.findUnique({ where: { employeeNumber: u.employeeNumber } }))) throw conflict("This employee number is already in use.");
  const user = await prisma.user.create({
    data: {
      email: u.email, name: u.name, status: "INVITED",
      profile: { create: { employeeNumber: u.employeeNumber || null, departmentId: u.departmentId || null, jobRoleId: u.jobRoleId || null, targetJobRoleId: u.targetJobRoleId || null, businessUnitId: u.businessUnitId || null, location: u.location || null, employmentStatus: u.employmentStatus, learningProgramme: u.learningProgramme || null, cpdPolicyId: u.cpdPolicyId || null } },
    },
  });
  await setRoles(user.id, u.roleKeys);
  await setManager(user.id, u.managerId || null);
  await audit(actor.id, "user.create", "user", user.id, { roles: u.roleKeys });
  const token = opts.invite ? await sendInvitation(user.id, actor.id) : null;
  return { user, token };
}

export async function updateUser(actor: Actor, userId: string, raw: unknown) {
  assertCan(actor, "user.manage");
  const u = userSchema.parse(raw);
  const existing = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  if (!existing) throw notFound("User");
  if (userId === actor.id && !u.roleKeys.includes("LD_ADMIN") && existing.roles.some((r) => r.role.key === "LD_ADMIN")) throw invalid("You cannot remove your own administrator role.");
  const dup = await prisma.user.findFirst({ where: { email: u.email, id: { not: userId } } });
  if (dup) throw conflict("Another user has this email address.");
  await prisma.user.update({ where: { id: userId }, data: { name: u.name, email: u.email } });
  const profileData = { employeeNumber: u.employeeNumber || null, departmentId: u.departmentId || null, jobRoleId: u.jobRoleId || null, targetJobRoleId: u.targetJobRoleId || null, businessUnitId: u.businessUnitId || null, location: u.location || null, employmentStatus: u.employmentStatus, learningProgramme: u.learningProgramme || null, cpdPolicyId: u.cpdPolicyId || null };
  await prisma.userProfile.upsert({ where: { userId }, create: { userId, ...profileData }, update: profileData });
  const before = existing.roles.map((r) => r.role.key).sort();
  await setRoles(userId, u.roleKeys);
  await setManager(userId, u.managerId || null);
  await audit(actor.id, "user.update", "user", userId, { rolesBefore: before, rolesAfter: [...u.roleKeys].sort() });
}

export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "DEACTIVATED") {
  assertCan(actor, "user.manage");
  if (userId === actor.id) throw invalid("You cannot change your own account status.");
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound("User");
  if (status === "ACTIVE" && !u.passwordHash) throw invalid("This user has not set a password yet. Resend the invitation instead.");
  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "DEACTIVATED") await revokeAllSessions(userId);
  await audit(actor.id, status === "ACTIVE" ? "user.activate" : "user.deactivate", "user", userId);
}

export interface ImportResult {
  created: number;
  errors: { line: number; message: string }[];
}

/** Validated CSV import: name,email,employee_number,department_code,job_role_code,manager_email,roles(;-separated). All-or-nothing. */
export async function importUsersCsv(actor: Actor, csv: string, invite: boolean): Promise<ImportResult> {
  assertCan(actor, "user.manage");
  const rows = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) throw invalid("The file has no data rows.");
  if (rows.length > 2001) throw invalid("Import at most 2,000 users per file.");
  const header = rows[0].toLowerCase().split(",").map((h) => h.trim());
  const expected = ["name", "email", "employee_number", "department_code", "job_role_code", "manager_email", "roles"];
  if (expected.some((h, i) => header[i] !== h)) throw invalid(`The header row must be: ${expected.join(",")}`);
  const [depts, jobRoles, roles, existingUsers] = await Promise.all([prisma.department.findMany(), prisma.jobRole.findMany(), prisma.role.findMany(), prisma.user.findMany({ select: { id: true, email: true } })]);
  const errors: { line: number; message: string }[] = [];
  const parsed: { name: string; email: string; employeeNumber: string; departmentId: string | null; jobRoleId: string | null; managerEmail: string; roleKeys: string[] }[] = [];
  const seen = new Set<string>();
  const parseLine = (l: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  rows.slice(1).forEach((line, idx) => {
    const n = idx + 2;
    const [name, emailRaw, employeeNumber, deptCode, roleCode, managerEmail, rolesRaw] = parseLine(line);
    const email = (emailRaw ?? "").toLowerCase();
    if (!name || name.length < 2) errors.push({ line: n, message: "Name is required." });
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ line: n, message: `Invalid email "${emailRaw ?? ""}".` });
    if (seen.has(email)) errors.push({ line: n, message: "Duplicate email in file." });
    if (existingUsers.some((u) => u.email === email)) errors.push({ line: n, message: `${email} already exists.` });
    seen.add(email);
    const dept = deptCode ? depts.find((d) => d.code === deptCode) : null;
    if (deptCode && !dept) errors.push({ line: n, message: `Unknown department code "${deptCode}".` });
    const jr = roleCode ? jobRoles.find((r) => r.code === roleCode) : null;
    if (roleCode && !jr) errors.push({ line: n, message: `Unknown job role code "${roleCode}".` });
    const roleKeys = (rolesRaw || "EMPLOYEE").split(";").map((r) => r.trim().toUpperCase()).filter(Boolean);
    for (const r of roleKeys) if (!roles.some((x) => x.key === r)) errors.push({ line: n, message: `Unknown role "${r}".` });
    parsed.push({ name, email, employeeNumber: employeeNumber ?? "", departmentId: dept?.id ?? null, jobRoleId: jr?.id ?? null, managerEmail: (managerEmail ?? "").toLowerCase(), roleKeys });
  });
  for (const [i, p] of parsed.entries()) {
    if (p.managerEmail && !existingUsers.some((u) => u.email === p.managerEmail) && !parsed.some((x) => x.email === p.managerEmail)) errors.push({ line: i + 2, message: `Manager ${p.managerEmail} not found.` });
  }
  if (errors.length) return { created: 0, errors };
  const created: { id: string; email: string }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const p of parsed) {
      const u = await tx.user.create({ data: { email: p.email, name: p.name, status: "INVITED", profile: { create: { employeeNumber: p.employeeNumber || null, departmentId: p.departmentId, jobRoleId: p.jobRoleId, businessUnitId: depts.find((d) => d.id === p.departmentId)?.businessUnitId ?? null } }, roles: { create: roles.filter((r) => p.roleKeys.includes(r.key)).map((r) => ({ roleId: r.id })) } } });
      created.push({ id: u.id, email: u.email });
    }
    const all = [...existingUsers, ...created];
    for (const p of parsed) {
      if (!p.managerEmail) continue;
      const m = all.find((u) => u.email === p.managerEmail)!;
      const e = created.find((u) => u.email === p.email)!;
      await tx.managerRelationship.create({ data: { managerId: m.id, employeeId: e.id } });
    }
  });
  await audit(actor.id, "user.import", "user", null, { created: created.length });
  if (invite) for (const u of created) await sendInvitation(u.id, actor.id);
  return { created: created.length, errors: [] };
}

export async function setRolePermission(actor: Actor, roleId: string, permission: string, enabled: boolean) {
  assertCan(actor, "role.manage");
  if (!(permission in PERMISSIONS)) throw invalid("Unknown permission.");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw notFound("Role");
  if (role.key === "LD_ADMIN" && (permission === "role.manage" || permission === "user.manage") && !enabled) throw invalid("The administrator role must keep role and user management to prevent lock-out.");
  const perm = await prisma.permission.findUniqueOrThrow({ where: { key: permission } });
  if (enabled) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId: perm.id } }, create: { roleId, permissionId: perm.id }, update: {} });
  else await prisma.rolePermission.deleteMany({ where: { roleId, permissionId: perm.id } });
  await audit(actor.id, enabled ? "role.permission.grant" : "role.permission.revoke", "role", roleId, { role: role.key, permission: permission as Permission });
}

const settingsSchemas: Record<SettingKey, z.ZodTypeAny> = {
  branding: z.object({ productName: z.string().trim().min(2).max(80), descriptor: z.string().trim().max(200), organisationName: z.string().trim().min(2).max(120), monogram: z.string().trim().min(1).max(2), supportEmail: z.string().email(), loginHeadline: z.string().trim().max(120), loginBody: z.string().trim().max(400) }),
  security: z.object({ sessionTtlHours: z.coerce.number().int().min(1).max(72), sessionIdleMinutes: z.coerce.number().int().min(5).max(480), maxFailedLogins: z.coerce.number().int().min(3).max(20), lockoutMinutes: z.coerce.number().int().min(1).max(1440) }),
  health: z.object({ learningOnTrackPercent: z.coerce.number().int().min(0).max(100), inactivityDays: z.coerce.number().int().min(7).max(730), cpdActionRatio: z.coerce.number().min(0).max(1), dueSoonDays: z.coerce.number().int().min(1).max(180), expiringDays: z.coerce.number().int().min(1).max(365), planReviewMonths: z.coerce.number().int().min(1).max(36), significantGapLevels: z.coerce.number().int().min(1).max(4) }),
  learning: z.object({ defaultPassingScore: z.coerce.number().int().min(1).max(100), defaultMaxAttempts: z.coerce.number().int().min(0).max(20), mandatoryDueSoonDays: z.coerce.number().int().min(1).max(180) }),
  notifications: z.object({ emailEnabled: z.boolean(), webinarReminderHours: z.coerce.number().int().min(1).max(168) }),
};

export async function saveSettings(actor: Actor, key: SettingKey, raw: unknown) {
  assertCan(actor, "settings.manage");
  if (!(key in DEFAULT_SETTINGS)) throw invalid("Unknown settings section.");
  const value = settingsSchemas[key].parse(raw);
  const before = await prisma.platformSetting.findUnique({ where: { key } });
  await prisma.platformSetting.upsert({ where: { key }, create: { key, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
  await audit(actor.id, "settings.update", "platform_setting", key, { before: (before?.value ?? null) as never, after: value });
}
