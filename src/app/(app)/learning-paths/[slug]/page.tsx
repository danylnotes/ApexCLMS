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

export default async function PathDetail({ params }: { params: Promise<{ slug: string }> }) {
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
        crumbs={[{ label: "Learning Paths", href: "/learning-paths" }, { label: path.title }]}
        eyebrow={`Learning path · ${path.code}`}
        title={path.title}
        description={path.summary}
        actions={!pe ? (
          <ActionForm action={startPathAction} inline><input type="hidden" name="pathId" value={path.id} /><SubmitButton>Start this path</SubmitButton></ActionForm>
        ) : next ? <LinkButton href={`/courses/${next.course.slug}`}>Next: {next.course.code}</LinkButton> : null}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Path structure" description="Complete required courses in order; a lock indicates a prerequisite within the path." bodyClassName="p-0">
          <ol>
            {path.items.map((i, n) => {
              const isDone = done.has(i.courseId);
              const open = unlocked(i);
              const e = enrolOf.get(i.courseId);
              return (
                <li key={i.id} className={`flex gap-4 border-b border-line px-5 py-4 last:border-0 ${next?.id === i.id ? "bg-navy-50/50" : ""}`}>
                  <span className="mt-0.5">{isDone ? <CheckCircle2 className="h-5 w-5 text-ok" aria-label="Completed" /> : open ? <Circle className="h-5 w-5 text-line-strong" aria-label="Available" /> : <Lock className="h-5 w-5 text-ink-faint" aria-label="Locked" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="type-eyebrow">Step {n + 1} · {i.isRequired ? "Required" : "Optional enrichment"} · {i.course.category.name}</p>
                    {openCourses.has(i.courseId) ? <Link href={`/courses/${i.course.slug}`} className="font-sans text-[0.9375rem] font-semibold">{i.course.title}</Link> : <p className="font-sans text-[0.9375rem] font-semibold text-ink-muted">{i.course.title} <span className="font-normal type-meta">· restricted to another job title — your administrator decides access</span></p>}
                    <p className="type-meta">{fmtHours(i.course.estimatedHours.toString())}{i.course.assessments[0] ? ` · assessed: ${i.course.assessments[0].title}` : ""}{i.prerequisiteItem && ` · after ${i.prerequisiteItem.course.title}`}</p>
                  </div>
                  <div className="shrink-0">{isDone ? <Status tone="ok">Completed</Status> : e ? <Status tone={ENROLLMENT[e.status][1]}>{ENROLLMENT[e.status][0]}</Status> : next?.id === i.id ? <Status tone="info">Recommended next</Status> : null}</div>
                </li>
              );
            })}
          </ol>
        </Panel>
        <aside className="space-y-6">
          <Panel title="Your progress">
            <Progress value={pct} label="Path progress" />
            <p className="mt-2 type-meta">{req.filter((i) => done.has(i.courseId)).length} of {req.length} required courses completed{pe ? ` · started ${fmtDate(pe.startedAt)}` : ""}{pe?.completedAt ? ` · completed ${fmtDate(pe.completedAt)}` : ""}</p>
          </Panel>
          <Panel title="About this path">
            <KeyValue cols={1} items={[["Target audience", path.targetAudience], ["Entry requirements", path.entryRequirements ?? "None"], ["Expected study hours", fmtHours(path.expectedHours.toString())], ["Estimated duration", path.estimatedDurationWeeks ? `${path.estimatedDurationWeeks} weeks` : "—"], ["CPD", path.cpdEligible ? "Courses carry configured CPD values" : "Not CPD-eligible"], ["Completion criteria", path.completionCriteria], ["Career objective", path.targetJobRole?.title ?? "—"]]} />
            <h3 className="type-eyebrow mt-4">Relevant competencies</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{path.competencies.map((c) => <Tag key={c.competencyId}>{c.competency.name}</Tag>)}</div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
