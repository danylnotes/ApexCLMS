import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import type { Permission } from "@/server/permissions";

/** Builds an Actor exactly as the session layer does, from the user's database roles. */
export async function actor(email: string): Promise<Actor> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  const permissions = new Set<Permission>();
  for (const r of u.roles) for (const p of r.role.permissions) permissions.add(p.permission.key as Permission);
  return { id: u.id, name: u.name, email: u.email, roles: u.roles.map((r) => r.role.key), permissions, isDemo: u.isDemo, sessionId: "test-session" };
}

export const course = (code: string) => prisma.course.findUniqueOrThrow({ where: { code }, include: { modules: { include: { lessons: true } }, assessments: { include: { questions: true } } } });

/** Correct answers for every objective question of an assessment. */
export async function correctAnswers(assessmentId: string) {
  const qs = await prisma.assessmentQuestion.findMany({ where: { assessmentId } });
  return qs.map((q) => ({ questionId: q.id, selectedOptionId: q.correctOptionId, booleanAnswer: q.correctBoolean, textAnswer: q.type === "SHORT_ANSWER" ? "A considered answer describing verification." : null }));
}

export async function wrongAnswers(assessmentId: string) {
  const qs = await prisma.assessmentQuestion.findMany({ where: { assessmentId } });
  return qs.map((q) => ({ questionId: q.id, selectedOptionId: q.type === "MULTIPLE_CHOICE" ? (q.correctOptionId === "a" ? "b" : "a") : null, booleanAnswer: q.type === "TRUE_FALSE" ? !q.correctBoolean : null, textAnswer: null }));
}

let n = 0;
/** Creates a fresh active employee for isolated scenarios. */
export async function freshEmployee(opts: { managerEmail?: string; roleCode?: string; policy?: string } = {}) {
  n++;
  const email = `it.user.${Date.now()}.${n}@apex-demo.test`;
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "EMPLOYEE" } });
  const jobRole = opts.roleCode ? await prisma.jobRole.findUnique({ where: { code: opts.roleCode } }) : null;
  const policy = opts.policy ? await prisma.cpdPolicy.findFirst({ where: { name: opts.policy } }) : null;
  const u = await prisma.user.create({ data: { email, name: `Test Employee ${n}`, status: "ACTIVE", emailVerifiedAt: new Date(), isDemo: true, roles: { create: [{ roleId: role.id }] }, profile: { create: { employeeNumber: `T-${Date.now().toString(36).toUpperCase()}-${n}`, jobRoleId: jobRole?.id, cpdPolicyId: policy?.id } }, accessGrants: jobRole ? { create: { jobRoleId: jobRole.id, reason: "Starting job title" } } : undefined } });
  if (opts.managerEmail) {
    const m = await prisma.user.findUniqueOrThrow({ where: { email: opts.managerEmail } });
    await prisma.managerRelationship.create({ data: { managerId: m.id, employeeId: u.id } });
  }
  return actor(email);
}
