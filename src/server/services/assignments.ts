import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { can, reportingScope } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { ensureAssignedEnrollment } from "./learning";
import { canAccessCourse, canAccessPath } from "./access";

export const assignSchema = z
  .object({
    target: z.enum(["USERS", "DEPARTMENT", "JOB_ROLE", "ALL"]),
    userIds: z.array(z.string()).default([]),
    departmentId: z.string().optional().nullable(),
    jobRoleId: z.string().optional().nullable(),
    courseId: z.string().optional().nullable(),
    pathId: z.string().optional().nullable(),
    kind: z.enum(["REQUIRED", "RECOMMENDED"]),
    isMandatory: z.boolean().default(false),
    dueDate: z.coerce.date().optional().nullable(),
    reason: z.string().trim().max(1000).optional().default(""),
  })
  .refine((v) => !!v.courseId !== !!v.pathId, "Choose either a course or a learning path")
  .refine((v) => !v.isMandatory || v.kind === "REQUIRED", "Mandatory training must be a required assignment")
  .refine((v) => !v.isMandatory || !!v.dueDate, "Mandatory training requires a due date");

/**
 * Assigns or recommends learning. Managers may target only employees in their reporting scope and
 * may not mark training as mandatory; administrators with mandatory.assign may target any audience.
 */
export async function assignLearning(actor: Actor, raw: unknown) {
  const input = assignSchema.parse(raw);
  const isAdmin = can(actor, "mandatory.assign");
  if (!isAdmin && !can(actor, "team.assign")) throw forbidden();
  if (input.isMandatory && !isAdmin) throw forbidden("Only L&D administrators can assign mandatory training.");
  if (input.dueDate && input.dueDate.getTime() < Date.now() - 86_400_000) throw invalid("The due date cannot be in the past.");

  let userIds: string[] = [];
  if (input.target === "USERS") userIds = input.userIds;
  else {
    if (!isAdmin) throw forbidden("Managers assign to named team members only.");
    const where =
      input.target === "DEPARTMENT" ? { profile: { departmentId: input.departmentId! } } : input.target === "JOB_ROLE" ? { profile: { jobRoleId: input.jobRoleId! } } : {};
    userIds = (await prisma.user.findMany({ where: { status: "ACTIVE", ...where }, select: { id: true } })).map((u) => u.id);
  }
  userIds = [...new Set(userIds)];
  if (!userIds.length) throw invalid("No eligible employees match the selected audience.");
  if (!isAdmin) {
    const scope = new Set(await reportingScope(actor.id));
    if (userIds.some((id) => !scope.has(id))) throw forbidden("One or more employees are outside your authorised scope.");
  }

  const course = input.courseId ? await prisma.course.findUnique({ where: { id: input.courseId } }) : null;
  const path = input.pathId ? await prisma.learningPath.findUnique({ where: { id: input.pathId }, include: { items: true } }) : null;
  if (input.courseId && (!course || course.status !== "PUBLISHED")) throw invalid("Only published courses can be assigned.");
  if (input.pathId && (!path || path.status !== "PUBLISHED")) throw invalid("Only published learning paths can be assigned.");
  const title = course?.title ?? path!.title;

  // Content is limited by job title. Named people without access are an error the assigner must resolve
  // (an administrator grants access first); audience-wide assignments simply leave them out.
  const permitted = async (userId: string) => (course ? canAccessCourse(userId, course.id) : canAccessPath(userId, path!));
  const allowed: string[] = [];
  for (const userId of userIds) if (await permitted(userId)) allowed.push(userId);
  const noAccess = userIds.length - allowed.length;
  if (input.target === "USERS" && noAccess) {
    const names = (await prisma.user.findMany({ where: { id: { in: userIds.filter((id) => !allowed.includes(id)) } }, select: { name: true } })).map((u) => u.name);
    throw invalid(`${names.join(", ")} ${names.length > 1 ? "do" : "does"} not have access to content for this job title. An administrator must grant access first.`);
  }
  userIds = allowed;

  const batchId = randomUUID();
  let created = 0;
  let skipped = 0;
  for (const userId of userIds) {
    const dup = await prisma.learningAssignment.findFirst({ where: { userId, status: "ASSIGNED", courseId: input.courseId ?? undefined, pathId: input.pathId ?? undefined } });
    if (dup) {
      skipped++;
      continue;
    }
    // A valid (unexpired) completion already satisfies a course assignment.
    let completedAt: Date | null = null;
    if (course) {
      const cert = await prisma.courseCompletion.findFirst({ where: { userId, courseId: course.id }, include: { certificate: true }, orderBy: { completedAt: "desc" } });
      const valid = cert && (!cert.certificate?.expiresAt || cert.certificate.expiresAt > new Date()) && cert.certificate?.status !== "REVOKED";
      if (valid) completedAt = cert!.completedAt;
    }
    const a = await prisma.learningAssignment.create({
      data: {
        userId,
        courseId: input.courseId || null,
        pathId: input.pathId || null,
        assignedById: actor.id,
        kind: input.kind,
        isMandatory: input.isMandatory,
        dueDate: input.dueDate ?? null,
        reason: input.reason || null,
        status: completedAt ? "COMPLETED" : "ASSIGNED",
        completedAt,
        batchId,
      },
    });
    if (input.kind === "REQUIRED" && course && !completedAt) {
      await ensureAssignedEnrollment(userId, course.id, input.dueDate ?? null);
    }
    if (input.kind === "REQUIRED" && path) {
      await prisma.learningPathEnrollment.upsert({ where: { pathId_userId: { pathId: path.id, userId } }, create: { pathId: path.id, userId }, update: {} });
    }
    if (!completedAt) {
      await notify(userId, {
        type: "ASSIGNMENT_NEW",
        title: input.isMandatory ? "Mandatory training assigned" : input.kind === "REQUIRED" ? "Learning assigned" : "Learning recommended",
        body: `${title}${input.dueDate ? ` — due ${input.dueDate.toISOString().slice(0, 10)}` : ""}.${input.reason ? ` ${input.reason}` : ""}`,
        link: course ? `/courses/${course.slug}` : `/learning-paths/${path!.slug}`,
        dedupeKey: `assignment:${a.id}`,
      });
    }
    created++;
  }
  await audit(actor.id, input.isMandatory ? "assignment.mandatory.create" : "assignment.create", course ? "course" : "learning_path", course?.id ?? path!.id, { batchId, created, skipped, noAccess, target: input.target });
  return { created, skipped, noAccess, batchId };
}

export async function cancelAssignment(actor: Actor, assignmentId: string) {
  const a = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!a || a.status !== "ASSIGNED") throw notFound("Assignment");
  const isAdmin = can(actor, "mandatory.assign");
  if (!isAdmin) {
    if (a.isMandatory || a.assignedById !== actor.id) throw forbidden("You can cancel only assignments you created.");
    if (!(await reportingScope(actor.id)).includes(a.userId)) throw forbidden();
  }
  await prisma.learningAssignment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
  await audit(actor.id, "assignment.cancel", "learning_assignment", a.id);
}
