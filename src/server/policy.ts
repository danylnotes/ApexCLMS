import { prisma } from "./db";
import { forbidden, notFound } from "./errors";
import type { Actor } from "./auth/session";
import type { Permission } from "./permissions";

/**
 * Authorisation policies. Every service function calls these on the server;
 * hiding UI elements is a convenience only.
 */

export const can = (actor: Actor, p: Permission) => actor.permissions.has(p);

export function assertCan(actor: Actor, ...anyOf: Permission[]) {
  if (!anyOf.some((p) => actor.permissions.has(p))) throw forbidden();
}

/** All employees within a manager's reporting line (direct and indirect, active LINE relationships). */
export async function reportingScope(managerId: string, maxDepth = 6): Promise<string[]> {
  const seen = new Set<string>();
  let frontier = [managerId];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const rels = await prisma.managerRelationship.findMany({
      where: { managerId: { in: frontier }, type: "LINE", OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
      select: { employeeId: true },
    });
    frontier = rels.map((r) => r.employeeId).filter((id) => !seen.has(id) && id !== managerId);
    frontier.forEach((id) => seen.add(id));
  }
  return [...seen];
}

export async function directReports(managerId: string): Promise<string[]> {
  const rels = await prisma.managerRelationship.findMany({
    where: { managerId, type: "LINE", OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
    select: { employeeId: true },
  });
  return rels.map((r) => r.employeeId);
}

/** Can the actor see an individual's private development records? */
export async function canViewEmployee(actor: Actor, employeeId: string): Promise<boolean> {
  if (actor.id === employeeId) return true;
  if (can(actor, "reports.org")) return true;
  if (can(actor, "team.view")) return (await reportingScope(actor.id)).includes(employeeId);
  return false;
}

export async function assertCanViewEmployee(actor: Actor, employeeId: string) {
  // Respond with "not found" rather than "forbidden" so record identifiers cannot be probed.
  if (!(await canViewEmployee(actor, employeeId))) throw notFound("Employee record");
}

/** Can the actor act on an employee as their manager (assign, assess, review plans)? */
export async function canManageEmployee(actor: Actor, employeeId: string, perm: Permission): Promise<boolean> {
  if (!can(actor, perm) || actor.id === employeeId) return false;
  if (can(actor, "reports.org") && (perm === "competency.assess" || perm === "enrolment.approve" || perm === "team.assign")) return true;
  return (await reportingScope(actor.id)).includes(employeeId);
}

export async function assertCanManageEmployee(actor: Actor, employeeId: string, perm: Permission) {
  if (!(await canManageEmployee(actor, employeeId, perm))) throw forbidden("This employee is outside your authorised scope.");
}

export async function isCourseInstructor(userId: string, courseId: string) {
  return !!(await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId } } }));
}

/** Course content management: administrators, or instructors assigned to the course. */
export async function canManageCourse(actor: Actor, courseId: string) {
  if (can(actor, "course.manage")) return true;
  return can(actor, "course.teach") && (await isCourseInstructor(actor.id, courseId));
}

export async function assertCanManageCourse(actor: Actor, courseId: string) {
  if (!(await canManageCourse(actor, courseId))) throw forbidden("You are not authorised to manage this course.");
}

/** Webinar operations: webinar managers or instructors (attendance recording where permitted). */
export function canOperateWebinars(actor: Actor) {
  return can(actor, "webinar.manage") || can(actor, "course.teach");
}
