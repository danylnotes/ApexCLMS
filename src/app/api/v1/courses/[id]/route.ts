import { apiRoute } from "@/server/api";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { canManageCourse } from "@/server/policy";

/** Course details (no lesson bodies — content is served only through the player to enrolled learners). */
export const GET = apiRoute<{ id: string }>(async (_req, actor, { id }) => {
  const c = await prisma.course.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      category: true,
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, type: true, durationMinutes: true, isRequired: true } } } },
      assessments: { select: { id: true, title: true, passingScore: true, maxAttempts: true, isFinal: true } },
      instructors: { select: { isLead: true, user: { select: { name: true } } } },
    },
  });
  if (!c || (c.status !== "PUBLISHED" && !(await canManageCourse(actor, c.id)))) throw notFound("Course");
  return c;
});
