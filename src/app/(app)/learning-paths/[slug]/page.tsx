import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { accessibleCourseIds, canAccessPath } from "@/server/services/access";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KeyValue, LinkButton, PageHeader, Panel, Progress, Status, Tag } from "@/components/ui";
import { ENROLLMENT } from "@/lib/status";
import { fmtDate, fmtHours } from "@/lib/format";
import { startPathAction } from "../../learner-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const p = await prisma.learningPath.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return { title: p?.title ?? t("Learning path") };
}

export default async function PathDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const { slug } = await params;
  const path = await prisma.learningPath.findUnique({
    where: { slug },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { course: { include: { category: true, assessments: { where: { isFinal: true }, select: { title: true } } } }, prerequisiteItem: { include: { course: { select: { title: true, id: true } } } } } },
      competencies: { include: { competency: true } },
      targetJobRole: true,
    },
  });
  if (!path || path.status !== "PUBLISHED" || !(await canAccessPath(actor.id, path))) notFound();
  const openCourses = await accessibleCourseIds(actor.id, path.items.map((i) => i.courseId));
  const [completions, enrollments, pe] = await Promise.all([
    prisma.courseCompletion.findMany({ where: { userId: actor.id, courseId: { in: path.items.map((i) => i.courseId) } } }),
    prisma.enrollment.findMany({ where: { userId: actor.id, courseId: { in: path.items.map((i) => i.courseId) } }, orderBy: { cycle: "desc" } }),
    prisma.learningPathEnrollment.findUnique({ where: { pathId_userId: { pathId: path.id, userId: actor.id } } }),
  ]);
  const done = new Set(completions.map((c) => c.courseId));
  const enrolOf = new Map<string, (typeof enrollments)[number]>();
  for (const e of enrollments) if (!enrolOf.has(e.courseId)) enrolOf.set(e.courseId, e);
  const req = path.items.filter((i) => i.isRequired);
  const pct = req.length ? Math.round((req.filter((i) => done.has(i.courseId)).length / req.length) * 100) : 0;
  const unlocked = (i: (typeof path.items)[number]) => !i.prerequisiteItem || done.has(i.prerequisiteItem.course.id);
  const next = path.items.find((i) => !done.has(i.courseId) && unlocked(i));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: t("Learning Paths"), href: "/learning-paths" }, { label: path.title }]}
        eyebrow={`${t("Learning path")} · ${path.code}`}
        title={path.title}
        description={path.summary}
        actions={!pe ? (
          <ActionForm action={startPathAction} inline><input type="hidden" name="pathId" value={path.id} /><SubmitButton>{t("Start this path")}</SubmitButton></ActionForm>
        ) : next ? <LinkButton href={`/courses/${next.course.slug}`}>{t("Next: {code}", { code: next.course.code })}</LinkButton> : null}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={t("Path structure")} description={t("Complete required courses in order; a lock indicates a prerequisite within the path.")} bodyClassName="p-0">
          <ol>
            {path.items.map((i, n) => {
              const isDone = done.has(i.courseId);
              const open = unlocked(i);
              const e = enrolOf.get(i.courseId);
              return (
                <li key={i.id} className={`flex gap-4 border-b border-line px-5 py-4 last:border-0 ${next?.id === i.id ? "bg-navy-50/50" : ""}`}>
                  <span className="mt-0.5">{isDone ? <CheckCircle2 className="h-5 w-5 text-ok" aria-label={t("Completed")} /> : open ? <Circle className="h-5 w-5 text-line-strong" aria-label={t("Available")} /> : <Lock className="h-5 w-5 text-ink-faint" aria-label={t("Locked")} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="type-eyebrow">{t("Step {number}", { number: n + 1 })} · {i.isRequired ? t("Required") : t("Optional enrichment")} · {i.course.category.name}</p>
                    {openCourses.has(i.courseId) ? <Link href={`/courses/${i.course.slug}`} className="font-sans text-[0.9375rem] font-semibold">{i.course.title}</Link> : <p className="font-sans text-[0.9375rem] font-semibold text-ink-muted">{i.course.title} <span className="font-normal type-meta">· {t("restricted to another job title — your administrator decides access")}</span></p>}
                    <p className="type-meta">{fmtHours(i.course.estimatedHours.toString())}{i.course.assessments[0] ? ` · ${t("assessed: {title}", { title: i.course.assessments[0].title })}` : ""}{i.prerequisiteItem && ` · ${t("after {title}", { title: i.prerequisiteItem.course.title })}`}</p>
                  </div>
                  <div className="shrink-0">{isDone ? <Status tone="ok">{t("Completed")}</Status> : e ? <Status tone={ENROLLMENT[e.status][1]}>{ENROLLMENT[e.status][0]}</Status> : next?.id === i.id ? <Status tone="info">{t("Recommended next")}</Status> : null}</div>
                </li>
              );
            })}
          </ol>
        </Panel>
        <aside className="space-y-6">
          <Panel title={t("Your progress")}>
            <Progress value={pct} label={t("Path progress")} />
            <p className="mt-2 type-meta">{t("{done} of {total} required courses completed", { done: req.filter((i) => done.has(i.courseId)).length, total: req.length })}{pe ? ` · ${t("started {date}", { date: fmtDate(pe.startedAt) })}` : ""}{pe?.completedAt ? ` · ${t("completed {date}", { date: fmtDate(pe.completedAt) })}` : ""}</p>
          </Panel>
          <Panel title={t("About this path")}>
            <KeyValue cols={1} items={[[t("Target audience"), path.targetAudience], [t("Entry requirements"), path.entryRequirements ?? t("None")], [t("Expected study hours"), fmtHours(path.expectedHours.toString())], [t("Estimated duration"), path.estimatedDurationWeeks ? t("{count, plural, one {# week} other {# weeks}}", { count: path.estimatedDurationWeeks }) : "—"], [t("CPD"), path.cpdEligible ? t("Courses carry configured CPD values") : t("Not CPD-eligible")], [t("Completion criteria"), path.completionCriteria], [t("Career objective"), path.targetJobRole?.title ?? "—"]]} />
            <h3 className="type-eyebrow mt-4">{t("Relevant competencies")}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{path.competencies.map((c) => <Tag key={c.competencyId}>{c.competency.name}</Tag>)}</div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
