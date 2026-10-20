import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, FileText, ListChecks, PenLine, ExternalLink, BookOpenText } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { canManageCourse } from "@/server/policy";
import { recertificationDue } from "@/server/services/learning";
import { canAccessCourse } from "@/server/services/access";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KeyValue, LinkButton, Notice, PageHeader, Panel, Progress, Status, Tag } from "@/components/ui";
import { courseProgress } from "@/lib/domain/progress";
import { COURSE_STATUS, CPD_STATUS, DELIVERY, DIFFICULTY, ENROLLMENT, ENROLMENT_RULE, LESSON_TYPE } from "@/lib/status";
import { fmtDate, fmtHours, fmtMinutes, fmtNum } from "@/lib/format";
import { enrolAction, withdrawAction } from "../../learner-actions";

const LESSON_ICON: Record<string, typeof Circle> = { TEXT: BookOpenText, PDF: FileText, DOCUMENT: FileText, EXTERNAL: ExternalLink, ASSESSMENT: ListChecks, ASSIGNMENT: PenLine, VIDEO: BookOpenText };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await prisma.course.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return { title: c?.title ?? "Course" };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireActor();
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      category: true,
      instructors: { include: { user: { select: { name: true, profile: { select: { jobRole: { select: { title: true } } } } } } }, orderBy: { isLead: "desc" } },
      departments: { include: { department: true } },
      competencies: { include: { competency: { include: { domain: { include: { framework: { include: { levels: true } } } } } } } },
      prerequisites: { include: { prerequisite: { select: { id: true, title: true, slug: true, code: true } } } },
      assessments: { include: { _count: { select: { questions: true } }, questions: { select: { type: true } } } },
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, type: true, durationMinutes: true, isRequired: true, resources: { select: { id: true } } } } } },
    },
  });
  const manager = course ? await canManageCourse(actor, course.id) : false;
  if (!course || (course.status !== "PUBLISHED" && !manager)) notFound();
  // Content intended for other job titles is not disclosed.
  if (!manager && !(await canAccessCourse(actor.id, course.id))) notFound();

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: actor.id, courseId: course.id },
    orderBy: { cycle: "desc" },
    include: { lessonProgress: true, completion: { include: { certificate: true } } },
  });
  const [assignment, prereqDone, claims, passedAttempts] = await Promise.all([
    prisma.learningAssignment.findFirst({ where: { userId: actor.id, courseId: course.id, status: "ASSIGNED" }, include: { assignedBy: { select: { name: true } } } }),
    prisma.courseCompletion.findMany({ where: { userId: actor.id, courseId: { in: course.prerequisites.map((p) => p.prerequisiteId) } }, select: { courseId: true } }),
    prisma.cpdClaim.findMany({ where: { userId: actor.id, activity: { courseCompletion: { courseId: course.id } } }, include: { activity: true } }),
    enrollment ? prisma.assessmentAttempt.findMany({ where: { enrollmentId: enrollment.id }, orderBy: { attemptNumber: "desc" } }) : Promise.resolve([]),
  ]);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const done = new Set(enrollment?.lessonProgress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const prog = courseProgress(lessons, done);
  const recert = enrollment?.status === "COMPLETED" ? await recertificationDue(actor.id, course.id, enrollment) : false;
  const prereqDoneSet = new Set(prereqDone.map((p) => p.courseId));
  const missingPrereqs = course.prerequisites.filter((p) => !prereqDoneSet.has(p.prerequisiteId));
  const final = course.assessments.find((a) => a.isFinal);
  const totalMinutes = lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
  const unit = course.cpdUnit === "POINTS" ? "points" : "hours";
  const sum = (st: string[]) => claims.filter((c) => st.includes(c.status)).reduce((s, c) => s + Number(st.includes("APPROVED") ? c.approvedValue ?? 0 : c.claimedValue), 0);
  const certificate = enrollment?.completion?.certificate ?? null;

  let action: React.ReactNode;
  const enrolForm = (label: string, variant: "primary" | "accent" = "primary") => (
    <ActionForm action={enrolAction} inline>
      <input type="hidden" name="courseId" value={course.id} />
      <SubmitButton variant={variant} pendingLabel="Enrolling…">{label}</SubmitButton>
    </ActionForm>
  );
  if (!enrollment || enrollment.status === "WITHDRAWN" || enrollment.status === "REJECTED") {
    if (missingPrereqs.length) action = <span className="type-meta">Complete the prerequisites to enrol</span>;
    else if (assignment) action = enrolForm("Start course");
    else if (course.enrolmentRule === "ASSIGNED_ONLY") action = <span className="type-meta">Available by assignment only</span>;
    else if (course.enrolmentRule === "APPROVAL_REQUIRED") action = enrolForm("Request approval");
    else action = enrolForm("Enrol");
  } else if (enrollment.status === "PENDING_APPROVAL") action = <Status tone="warn">Awaiting manager approval</Status>;
  else if (enrollment.status === "COMPLETED") action = (
    <div className="flex flex-wrap gap-2">
      {recert && enrolForm("Start recertification", "accent")}
      <LinkButton href={`/learn/${course.slug}`} variant={recert ? "secondary" : "primary"}>Review completed course</LinkButton>
    </div>
  );
  else action = <LinkButton href={`/learn/${course.slug}`}>{prog.completed > 0 ? "Continue learning" : "Start course"}</LinkButton>;

  const enrolSt = enrollment ? ENROLLMENT[enrollment.status] : null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Course Catalogue", href: "/catalogue" }, { label: course.category.name, href: `/catalogue?category=${course.category.slug}` }, { label: course.code }]}
        eyebrow={`${course.category.name} · ${course.code}`}
        title={course.title}
        description={course.synopsis}
        actions={action}
        meta={
          <>
            <span>{DIFFICULTY[course.difficulty]}</span>
            <span>{DELIVERY[course.deliveryMode]}</span>
            <span>{fmtHours(course.estimatedHours.toString())} estimated study</span>
            <span>{course.cpdEligible ? `${fmtNum(course.cpdValue?.toString())} CPD ${unit} (configured value)` : "Not CPD-eligible"}</span>
            <span>Updated {fmtDate(course.updatedAt)}</span>
            {course.status !== "PUBLISHED" && <Status tone={COURSE_STATUS[course.status][1]}>{COURSE_STATUS[course.status][0]}</Status>}
          </>
        }
      />

      {course.status !== "PUBLISHED" && <div className="mb-6"><Notice tone="warn" title="Preview">This course is not published. You are viewing it as a course manager.</Notice></div>}
      {assignment && (
        <div className="mb-6">
          <Notice tone={assignment.isMandatory ? "crit" : "info"} title={assignment.isMandatory ? "Mandatory training" : "Assigned to you"}>
            Assigned by {assignment.assignedBy.name}{assignment.dueDate ? ` · due ${fmtDate(assignment.dueDate)}` : ""}.{assignment.reason ? ` ${assignment.reason}` : ""}
          </Notice>
        </div>
      )}
      {missingPrereqs.length > 0 && !enrollment && (
        <div className="mb-6">
          <Notice tone="warn" title="Prerequisites required">
            Complete {missingPrereqs.map((p, i) => <span key={p.prerequisiteId}>{i > 0 && ", "}<Link href={`/courses/${p.prerequisite.slug}`}>{p.prerequisite.title}</Link></span>)} before enrolling.
          </Notice>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="about">
            <h2 id="about" className="type-title mb-3">About this course</h2>
            <div className="prose-lesson">
              {course.overview.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="type-section">Why it matters</h3>
                <p className="mt-1 text-[0.9375rem] text-ink-muted">{course.businessRelevance ?? "—"}</p>
              </div>
              <div>
                <h3 className="type-section">Who should take it</h3>
                <p className="mt-1 text-[0.9375rem] text-ink-muted">{course.intendedAudience ?? "—"}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">{course.departments.map((d) => <Tag key={d.departmentId}>{d.department.name}</Tag>)}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="What you will learn">
              <ol className="list-decimal space-y-1.5 pl-5 text-[0.9rem]">{course.objectives.map((o, i) => <li key={i}>{o}</li>)}</ol>
            </Panel>
            <Panel title="Expected outcomes">
              <ul className="list-disc space-y-1.5 pl-5 text-[0.9rem]">{course.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
              <h3 className="type-eyebrow mt-4">Prerequisites</h3>
              <p className="mt-1 text-[0.875rem] text-ink-muted">{course.prerequisitesText ?? "None"}</p>
            </Panel>
          </div>

          <Panel id="curriculum" title="Curriculum" description={`${course.modules.length} modules · ${lessons.length} items · ${fmtMinutes(totalMinutes)} of scheduled content`} bodyClassName="p-0">
            {course.modules.map((m, mi) => {
              const mDone = m.lessons.filter((l) => done.has(l.id)).length;
              return (
                <details key={m.id} open={mi === 0} className="group border-b border-line last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block font-sans text-sm font-semibold text-ink">{m.title}</span>
                      {m.description && <span className="block type-meta">{m.description}</span>}
                    </span>
                    <span className="shrink-0 type-meta">{enrollment ? `${mDone}/${m.lessons.length} · ` : ""}{fmtMinutes(m.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0))}</span>
                  </summary>
                  <ul className="pb-2">
                    {m.lessons.map((l) => {
                      const Icon = LESSON_ICON[l.type] ?? Circle;
                      const isDone = done.has(l.id);
                      return (
                        <li key={l.id} className="flex items-center gap-3 px-5 py-2 pl-8 text-[0.875rem]">
                          {enrollment ? (isDone ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-label="Completed" /> : <Circle className="h-4 w-4 shrink-0 text-line-strong" aria-label="Not completed" />) : <Icon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />}
                          <span className="min-w-0 flex-1">{l.title}{!l.isRequired && <span className="ml-2 type-meta">(optional)</span>}{l.resources.length > 0 && <span className="ml-2 type-meta">· download</span>}</span>
                          <span className="shrink-0 type-meta">{LESSON_TYPE[l.type]} · {fmtMinutes(l.durationMinutes)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </Panel>

          {course.competencies.length > 0 && (
            <Panel title="Competencies developed" description="Course completion is recorded as knowledge evidence. Workplace competence is confirmed separately unless the framework states otherwise.">
              <ul className="divide-y divide-line">
                {course.competencies.map((cc) => {
                  const fw = cc.competency.domain.framework;
                  return (
                    <li key={cc.competencyId} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <span className="text-[0.9rem]"><span className="font-sans text-[0.75rem] text-ink-faint">{cc.competency.code}</span> {cc.competency.name}</span>
                      <span className="type-meta">Designed to level {cc.targetLevel} · {fw.levels.find((l) => l.level === cc.targetLevel)?.name}{fw.allowCourseCompletionAsCompetence ? " · counts as competence evidence" : " · knowledge evidence"}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {enrollment && enrolSt && (
            <Panel title="Your progress">
              <div className="mb-3 flex items-center justify-between"><Status tone={enrolSt[1]}>{enrolSt[0]}</Status>{enrollment.cycle > 1 && <span className="type-meta">Cycle {enrollment.cycle}</span>}</div>
              {enrollment.status !== "PENDING_APPROVAL" && <Progress value={enrollment.status === "COMPLETED" ? 100 : prog.percent} label="Course progress" />}
              <p className="mt-2 type-meta">{prog.completed} of {prog.total} required items completed</p>
              {enrollment.completedAt && <p className="type-meta">Completed {fmtDate(enrollment.completedAt)}</p>}
              {passedAttempts[0] && <p className="type-meta">Latest assessment: {passedAttempts[0].percent ?? "—"}% ({passedAttempts[0].status === "PENDING_REVIEW" ? "awaiting review" : passedAttempts[0].passed ? "passed" : "not passed"})</p>}
              {enrollment.status === "ACTIVE" && !assignment?.isMandatory && (
                <ActionForm action={withdrawAction} inline className="mt-3">
                  <input type="hidden" name="courseId" value={course.id} />
                  <SubmitButton variant="ghost" size="sm" confirm="Withdraw from this course? Your progress is kept if you re-enrol.">Withdraw</SubmitButton>
                </ActionForm>
              )}
            </Panel>
          )}

          <Panel title="Study time and CPD">
            <KeyValue
              cols={1}
              items={[
                ["Estimated study time", fmtHours(course.estimatedHours.toString())],
                ["Your recorded learning time", enrollment ? fmtMinutes(Math.round(enrollment.timeSpentSeconds / 60)) : "—"],
                ["CPD value (configured)", course.cpdEligible ? `${fmtNum(course.cpdValue?.toString())} ${unit}` : "Not CPD-eligible"],
                ["Your CPD submitted / pending", claims.length ? `${fmtNum(sum(["SUBMITTED", "UNDER_REVIEW"]))} ${unit}` : "—"],
                ["Your CPD approved", claims.length ? `${fmtNum(sum(["APPROVED"]))} ${unit}` : "—"],
                ["Your CPD rejected", claims.some((c) => c.status === "REJECTED") ? `${fmtNum(claims.filter((c) => c.status === "REJECTED").reduce((s, c) => s + Number(c.claimedValue), 0))} ${unit}` : "—"],
              ]}
            />
            {claims.map((c) => <p key={c.id} className="mt-2 type-meta"><Link href={`/cpd/${c.id}`}>CPD claim</Link> · <Status tone={CPD_STATUS[c.status][1]}>{CPD_STATUS[c.status][0]}</Status></p>)}
            <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] text-ink-muted">{course.cpdAccreditationNote ?? "Estimated study time does not automatically qualify as CPD. CPD is credited only through an approved claim under your CPD policy."}</p>
          </Panel>

          <Panel title="Assessment and certification">
            <KeyValue
              cols={1}
              items={[
                ["Assessment", final ? `${final.title} — ${final._count.questions} questions (${[...new Set(final.questions.map((q) => q.type === "MULTIPLE_CHOICE" ? "multiple choice" : q.type === "TRUE_FALSE" ? "true/false" : "short answer"))].join(", ")})` : "No final assessment"],
                ["Passing score", final ? `${final.passingScore}%` : "—"],
                ["Attempts allowed", final ? (final.maxAttempts === 0 ? "Unlimited" : String(final.maxAttempts)) : "—"],
                ["Completion requirements", [course.requireAllLessons && "all required lessons", course.requireAssessmentPass && "pass the final assessment", course.requireAssignmentApproval && "instructor-approved assignment", course.requireAcknowledgement && "signed acknowledgement"].filter(Boolean).join("; ")],
                ["Certificate", course.certificateEnabled ? (course.certificateValidityMonths ? `Issued on completion; valid ${course.certificateValidityMonths} months` : "Issued on completion; does not expire") : "No certificate"],
                ["Recertification", course.recertificationNote ?? "Not required"],
                ["Enrolment", ENROLMENT_RULE[course.enrolmentRule]],
              ]}
            />
            {certificate && (
              <p className="mt-3 border-t border-line pt-3 text-sm">
                Certificate {certificate.serial} · {certificate.expiresAt ? `expires ${fmtDate(certificate.expiresAt)}` : "no expiry"} · <a href={`/api/v1/certificates/${certificate.id}/pdf`}>Download PDF</a>
              </p>
            )}
          </Panel>

          <Panel title="Instructors">
            <ul className="space-y-2">
              {course.instructors.map((i) => (
                <li key={i.userId} className="text-[0.875rem]"><span className="font-medium">{i.user.name}</span>{i.isLead && <span className="type-meta"> · lead</span>}<br /><span className="type-meta">{i.user.profile?.jobRole?.title}</span></li>
              ))}
            </ul>
            <p className="mt-3 type-meta">Provider: {course.provider}</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
