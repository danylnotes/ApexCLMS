import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { contentAccess, courseAudienceWhere } from "./access";

export interface CatalogueQuery {
  q?: string;
  category?: string;
  department?: string;
  competency?: string;
  difficulty?: string;
  duration?: string; // "lt2" | "2-8" | "8-20" | "gt20"
  cpd?: string; // "yes"
  delivery?: string;
  mandatory?: string; // "yes" | "no"
  availability?: string; // OPEN | APPROVAL_REQUIRED | ASSIGNED_ONLY
  sort?: string; // relevance | title | duration | recent
  page?: number;
  pageSize?: number;
}

const DURATION: Record<string, Prisma.DecimalFilter> = {
  lt2: { lt: 2 },
  "2-8": { gte: 2, lte: 8 },
  "8-20": { gt: 8, lte: 20 },
  gt20: { gt: 20 },
};

/**
 * Published course discovery. Relevance ranking is computed in memory over the filtered set
 * (title match > code > keyword > synopsis), which is appropriate for catalogues of a few
 * thousand courses; beyond that, move to PostgreSQL full-text search (documented).
 */
export async function searchCatalogue(userId: string, query: CatalogueQuery) {
  const pageSize = query.pageSize ?? 12;
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  // Only content intended for the job titles this person has been granted.
  const and: Prisma.CourseWhereInput[] = [courseAudienceWhere(await contentAccess(userId))];
  const q = query.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { synopsis: { contains: q, mode: "insensitive" } },
        { keywords: { has: q.toLowerCase() } },
        { overview: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (query.category) and.push({ category: { slug: query.category } });
  if (query.department) and.push({ departments: { some: { departmentId: query.department } } });
  if (query.competency) and.push({ competencies: { some: { competencyId: query.competency } } });
  if (query.difficulty) and.push({ difficulty: query.difficulty as never });
  if (query.duration && DURATION[query.duration]) and.push({ estimatedHours: DURATION[query.duration] });
  if (query.cpd === "yes") and.push({ cpdEligible: true });
  if (query.delivery) and.push({ deliveryMode: query.delivery as never });
  if (query.mandatory === "yes") and.push({ isMandatory: true });
  if (query.mandatory === "no") and.push({ isMandatory: false });
  if (query.availability) and.push({ enrolmentRule: query.availability as never });
  if (and.length) where.AND = and;

  const rows = await prisma.course.findMany({
    where,
    select: {
      id: true, slug: true, code: true, title: true, synopsis: true, keywords: true, difficulty: true, deliveryMode: true, estimatedHours: true,
      cpdEligible: true, cpdValue: true, cpdUnit: true, isMandatory: true, enrolmentRule: true, provider: true, publishedAt: true,
      category: { select: { name: true, slug: true } },
      instructors: { where: { isLead: true }, select: { user: { select: { name: true } } } },
    },
  });
  const score = (r: (typeof rows)[number]) => {
    if (!q) return 0;
    const s = q.toLowerCase();
    return (r.title.toLowerCase().includes(s) ? 8 : 0) + (r.code.toLowerCase().includes(s) ? 6 : 0) + (r.keywords.some((k) => k.includes(s)) ? 4 : 0) + (r.synopsis.toLowerCase().includes(s) ? 2 : 0);
  };
  const sort = query.sort ?? (q ? "relevance" : "title");
  rows.sort((a, b) => {
    if (sort === "duration") return Number(a.estimatedHours) - Number(b.estimatedHours);
    if (sort === "recent") return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    if (sort === "relevance") return score(b) - score(a) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  const items = rows.slice((page - 1) * pageSize, page * pageSize);
  const enrolments = await prisma.enrollment.findMany({ where: { userId, courseId: { in: items.map((i) => i.id) } }, orderBy: { cycle: "desc" }, select: { courseId: true, status: true } });
  const statusOf = new Map<string, string>();
  for (const e of enrolments) if (!statusOf.has(e.courseId)) statusOf.set(e.courseId, e.status);
  return { items: items.map((i) => ({ ...i, enrolmentStatus: statusOf.get(i.id) ?? null })), total, page, pages, sort };
}

export async function catalogueFacets() {
  const [categories, departments, competencies] = await Promise.all([
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.competency.findMany({ where: { isActive: true, courses: { some: {} } }, orderBy: { code: "asc" } }),
  ]);
  return { categories, departments, competencies };
}
