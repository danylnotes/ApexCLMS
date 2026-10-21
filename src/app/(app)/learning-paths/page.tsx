import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { contentAccess, pathAudienceWhere } from "@/server/services/access";
import { PageHeader, Progress, Tag } from "@/components/ui";
import { fmtHours } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Learning Paths") };
}

export default async function PathsPage() {
  const { t } = await getI18n();
  const actor = await requireActor();
  const access = await contentAccess(actor.id);
  const [paths, completions, mine] = await Promise.all([
    prisma.learningPath.findMany({ where: { status: "PUBLISHED", OR: [pathAudienceWhere(access), { enrollments: { some: { userId: actor.id } } }, { assignments: { some: { userId: actor.id, status: { not: "CANCELLED" } } } }] }, orderBy: { title: "asc" }, include: { items: { select: { courseId: true, isRequired: true } }, targetJobRole: true } }),
    prisma.courseCompletion.findMany({ where: { userId: actor.id }, select: { courseId: true } }),
    prisma.learningPathEnrollment.findMany({ where: { userId: actor.id } }),
  ]);
  const done = new Set(completions.map((c) => c.courseId));
  const started = new Set(mine.map((m) => m.pathId));
  return (
    <div>
      <PageHeader eyebrow={t("Learning")} title={t("Learning Paths")} description={t("Structured programmes for specific roles and career objectives. Each path distinguishes required courses from optional enrichment.")} />
      <ul className="grid gap-x-10 gap-y-0 md:grid-cols-2">
        {paths.map((p) => {
          const req = p.items.filter((i) => i.isRequired);
          const pct = req.length ? Math.round((req.filter((i) => done.has(i.courseId)).length / req.length) * 100) : 0;
          return (
            <li key={p.id} className="border-b border-line py-5">
              <p className="type-eyebrow">{p.code}{p.targetJobRole ? ` · ${t("towards {role}", { role: p.targetJobRole.title })}` : ""}</p>
              <h2 className="mt-1 font-serif text-[1.125rem] font-semibold"><Link href={`/learning-paths/${p.slug}`} className="text-navy no-underline hover:underline">{p.title}</Link></h2>
              <p className="mt-1 text-[0.9rem] text-ink-muted">{p.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><Tag>{t("{required} required · {optional} optional", { required: req.length, optional: p.items.length - req.length })}</Tag><Tag>{fmtHours(p.expectedHours.toString())}</Tag>{p.estimatedDurationWeeks && <Tag>{t("~{count, plural, one {# week} other {# weeks}}", { count: p.estimatedDurationWeeks })}</Tag>}{p.cpdEligible && <Tag>{t("CPD-eligible")}</Tag>}</div>
              {(started.has(p.id) || pct > 0) && <div className="mt-3 max-w-xs"><Progress value={pct} label={t("{title} progress", { title: p.title })} size="sm" /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
