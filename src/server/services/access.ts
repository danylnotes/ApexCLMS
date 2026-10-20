import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, isCourseInstructor } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";

/**
 * Job-title content access.
 *
 * A course with audience rows is visible only to staff holding a grant for one of those job titles;
 * a course without audience rows is open to everyone. A learning path aimed at a job title needs a
 * grant for that title. Grants are decided by administrators (`user.manage`): changing someone's job
 * title never opens the next level's content by itself.
 *
 * Learning records are never hidden: a course or path the person is already enrolled on or assigned
 * stays accessible, because that enrolment or assignment was itself an authorised decision.
 */
export interface ContentAccess {
  all: boolean;
  roleIds: string[];
}

const bypass = (permissions: Iterable<string>) => [...permissions].includes("course.manage");

/** Grants plus whether the user can see all content (content administrators). Cached per request. */
export const contentAccess = cache(async (userId: string): Promise<ContentAccess> => {
  const [grants, roles] = await Promise.all([
    prisma.contentAccessGrant.findMany({ where: { userId }, select: { jobRoleId: true } }),
    prisma.userRole.findMany({ where: { userId }, select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } } }),
  ]);
  const perms = roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key));
  return { all: bypass(perms), roleIds: grants.map((g) => g.jobRoleId) };
});

/** Prisma filter for courses whose audience the user may discover. */
export function courseAudienceWhere(access: ContentAccess): Prisma.CourseWhereInput {
  if (access.all) return {};
  return { OR: [{ audiences: { none: {} } }, { audiences: { some: { jobRoleId: { in: access.roleIds } } } }] };
}

export function pathAudienceWhere(access: ContentAccess): Prisma.LearningPathWhereInput {
  if (access.all) return {};
  return { OR: [{ targetJobRoleId: null }, { targetJobRoleId: { in: access.roleIds } }] };
}

export async function canAccessCourse(userId: string, courseId: string): Promise<boolean> {
  const access = await contentAccess(userId);
  if (access.all) return true;
  const audiences = await prisma.courseAudience.findMany({ where: { courseId }, select: { jobRoleId: true } });
  if (!audiences.length || audiences.some((a) => access.roleIds.includes(a.jobRoleId))) return true;
  const [enrolled, assigned, viaPath, teaches] = await Promise.all([
    prisma.enrollment.count({ where: { userId, courseId } }),
    prisma.learningAssignment.count({ where: { userId, courseId, status: { not: "CANCELLED" } } }),
    prisma.learningAssignment.count({ where: { userId, status: { not: "CANCELLED" }, path: { items: { some: { courseId } } } } }),
    isCourseInstructor(userId, courseId),
  ]);
  return enrolled + assigned + viaPath > 0 || teaches;
}

/** Responds "not found" so content intended for other job titles cannot be probed. */
export async function assertCanAccessCourse(userId: string, courseId: string) {
  if (!(await canAccessCourse(userId, courseId))) throw notFound("Course");
}

export async function canAccessPath(userId: string, path: { id: string; targetJobRoleId: string | null }): Promise<boolean> {
  const access = await contentAccess(userId);
  if (access.all || !path.targetJobRoleId || access.roleIds.includes(path.targetJobRoleId)) return true;
  const [enrolled, assigned] = await Promise.all([
    prisma.learningPathEnrollment.count({ where: { userId, pathId: path.id } }),
    prisma.learningAssignment.count({ where: { userId, pathId: path.id, status: { not: "CANCELLED" } } }),
  ]);
  return enrolled + assigned > 0;
}

export async function assertCanAccessPath(userId: string, path: { id: string; targetJobRoleId: string | null }) {
  if (!(await canAccessPath(userId, path))) throw notFound("Learning path");
}

/** Of the given course ids, which ones the user may open. */
export async function accessibleCourseIds(userId: string, courseIds: string[]): Promise<Set<string>> {
  if (!courseIds.length) return new Set();
  const access = await contentAccess(userId);
  if (access.all) return new Set(courseIds);
  const open = await prisma.course.findMany({ where: { id: { in: courseIds }, ...courseAudienceWhere(access) }, select: { id: true } });
  const ok = new Set(open.map((c) => c.id));
  for (const id of courseIds) if (!ok.has(id) && (await canAccessCourse(userId, id))) ok.add(id);
  return ok;
}

/** What a staff member's Staff ID resolves to: job title, grade and content access levels. */
export async function accessSummary(userId: string) {
  const [profile, grants, access] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId }, select: { employeeNumber: true, jobRole: { select: { id: true, title: true, grade: true, code: true } } } }),
    prisma.contentAccessGrant.findMany({ where: { userId }, include: { jobRole: { select: { id: true, title: true, grade: true, code: true } }, grantedBy: { select: { name: true } } }, orderBy: { jobRole: { grade: "asc" } } }),
    contentAccess(userId),
  ]);
  const jobRole = profile?.jobRole ?? null;
  return {
    staffId: profile?.employeeNumber ?? null,
    jobRole,
    grants,
    allContent: access.all,
    /** Set when the job title changed (e.g. promotion) and an administrator has not yet opened its content. */
    pendingCurrentRole: !!jobRole && !grants.some((g) => g.jobRoleId === jobRole.id),
  };
}

// ───────────────────────── Administration ─────────────────────────

export async function grantContentAccess(actor: Actor, userId: string, jobRoleId: string, reason?: string) {
  assertCan(actor, "user.manage");
  const [user, role] = await Promise.all([prisma.user.findUnique({ where: { id: userId } }), prisma.jobRole.findUnique({ where: { id: jobRoleId } })]);
  if (!user) throw notFound("User");
  if (!role) throw invalid("Choose a job title.");
  if (await prisma.contentAccessGrant.findUnique({ where: { userId_jobRoleId: { userId, jobRoleId } } })) throw conflict(`${user.name} already has access to ${role.title} content.`);
  const grant = await prisma.contentAccessGrant.create({ data: { userId, jobRoleId, grantedById: actor.id, reason: reason?.trim() || null } });
  await audit(actor.id, "access.grant", "user", userId, { jobRole: role.code });
  await notify(userId, { type: "SYSTEM", title: "New learning content available", body: `You now have access to learning content for ${role.title}.`, link: "/catalogue", dedupeKey: `grant:${grant.id}` });
  return grant;
}

export async function revokeContentAccess(actor: Actor, grantId: string) {
  assertCan(actor, "user.manage");
  const grant = await prisma.contentAccessGrant.findUnique({ where: { id: grantId }, include: { jobRole: true } });
  if (!grant) throw notFound("Access grant");
  if (grant.userId === actor.id) throw forbidden("You cannot change your own content access.");
  await prisma.contentAccessGrant.delete({ where: { id: grantId } });
  await audit(actor.id, "access.revoke", "user", grant.userId, { jobRole: grant.jobRole.code });
}

export async function setCourseAudience(actor: Actor, courseId: string, jobRoleIds: string[]) {
  assertCan(actor, "course.manage");
  const ids = [...new Set(jobRoleIds.filter(Boolean))];
  await prisma.$transaction([
    prisma.courseAudience.deleteMany({ where: { courseId } }),
    prisma.courseAudience.createMany({ data: ids.map((jobRoleId) => ({ courseId, jobRoleId })) }),
  ]);
  await audit(actor.id, "course.audience", "course", courseId, { jobRoleIds: ids });
}
