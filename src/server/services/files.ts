import { prisma } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../auth/session";
import { can, canManageCourse, canManageEmployee, canViewEmployee } from "../policy";

/** Authorises access to a private file by checking every record that references it. */
export async function authoriseFile(actor: Actor, fileId: string) {
  const file = await prisma.storedFile.findUnique({
    where: { id: fileId },
    include: {
      lessonResources: { include: { lesson: { include: { module: true } } } },
      cpdEvidence: { include: { claim: true } },
      competencyEvidence: { include: { assessment: true } },
      submissions: { include: { lesson: { include: { module: true } } } },
      credentials: true,
      competencyRequests: true,
    },
  });
  if (!file) throw notFound("File");
  if (file.uploadedById === actor.id || file.purpose === "BRANDING") return file;
  for (const r of file.lessonResources) {
    const courseId = r.lesson.module.courseId;
    const enrolled = await prisma.enrollment.count({ where: { userId: actor.id, courseId, status: { in: ["ACTIVE", "COMPLETED"] } } });
    if (enrolled || (await canManageCourse(actor, courseId))) return file;
  }
  for (const e of file.cpdEvidence) if (e.claim.userId === actor.id || can(actor, "cpd.approve") || (await canViewEmployee(actor, e.claim.userId))) return file;
  for (const e of file.competencyEvidence) if (await canViewEmployee(actor, e.assessment.userId)) return file;
  for (const s of file.submissions) if (s.userId === actor.id || (await canManageCourse(actor, s.lesson.module.courseId))) return file;
  for (const c of file.credentials) if (await canViewEmployee(actor, c.userId)) return file;
  for (const r of file.competencyRequests) if (r.userId === actor.id || (await canManageEmployee(actor, r.userId, "competency.assess"))) return file;
  throw notFound("File");
}
