import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS } from "@/lib/status";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { gradeAttemptAction, reviewSubmissionAction } from "../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Teaching Workspace") };
}

export default async function TeachingPage() {
  const actor = await requirePagePermission("course.teach");
  const { t } = await getI18n();
  const courseWhere = can(actor, "course.manage") ? {} : { instructors: { some: { userId: actor.id } } };
  const courses = await prisma.course.findMany({
    where: { ...courseWhere, status: { not: "ARCHIVED" } },
    orderBy: { code: "asc" },
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } }, completions: true } }, instructors: { where: { userId: actor.id } } },
  });
  const courseIds = courses.map((c) => c.id);
  const [attempts, submissions, webinars] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where: { status: "PENDING_REVIEW", assessment: { courseId: { in: courseIds } }, userId: { not: actor.id } },
      include: { user: { select: { name: true } }, assessment: { include: { course: { select: { title: true, code: true } } } }, responses: { include: { question: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: "SUBMITTED", lesson: { module: { courseId: { in: courseIds } } }, userId: { not: actor.id } },
      include: { user: { select: { name: true } }, lesson: { include: { module: { include: { course: { select: { title: true, code: true } } } } } }, file: { select: { id: true, originalName: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.webinar.findMany({ where: { status: { in: ["SCHEDULED", "COMPLETED"] }, startsAt: { lt: new Date(), gt: new Date(Date.now() - 60 * 86_400_000) } }, orderBy: { startsAt: "desc" }, include: { _count: { select: { registrations: true, attendance: true } } } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow={t("Teaching")} title={t("Teaching Workspace")} description={t("Review learner submissions, grade short-answer assessments, record webinar attendance and maintain the content of your assigned courses.")} />
      <div className="space-y-8">
        <Panel title={t("Assessments awaiting grading")} description={t("Short-answer responses require instructor judgement. Grades are final once recorded.")} bodyClassName={attempts.length ? "p-0" : undefined}>
          {attempts.length === 0 ? <EmptyState title={t("Nothing to grade")} /> : attempts.map((a) => (
            <ActionForm key={a.id} action={gradeAttemptAction} className="border-b border-line px-5 py-5 last:border-0">
              <input type="hidden" name="attemptId" value={a.id} />
              <p className="type-eyebrow">{a.assessment.course.code} · {a.assessment.title} · {t("attempt {number}", { number: a.attemptNumber })}</p>
              <p className="font-sans text-sm font-semibold">{a.user.name} <span className="font-normal text-ink-muted">{t("· submitted {date}", { date: fmtDate(a.submittedAt) })}</span></p>
              <p className="mt-1 type-meta">{t("Objective questions auto-scored: {awarded} of {total} points. Pass mark {pass}%.", { awarded: a.responses.filter((r) => r.pointsAwarded != null).reduce((s, r) => s + (r.pointsAwarded ?? 0), 0), total: a.responses.filter((r) => r.question.type !== "SHORT_ANSWER").reduce((s, r) => s + r.question.points, 0), pass: a.assessment.passingScore })}</p>
              {a.responses.filter((r) => r.pointsAwarded == null).map((r) => (
                <div key={r.id} className="mt-4 rounded border border-line p-4">
                  <input type="hidden" name="responseId" value={r.id} />
                  <p className="font-sans text-sm font-medium">{r.question.prompt}</p>
                  <blockquote className="mt-2 border-s-2 border-line-strong ps-3 text-[0.9375rem]">{r.textAnswer}</blockquote>
                  {r.question.guidance && <p className="mt-2 type-meta">{t("Marking guidance: {guidance}", { guidance: r.question.guidance })}</p>}
                  <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                    <Field label={t("Points (max {max})", { max: r.question.points })} htmlFor={`p-${r.id}`}><input id={`p-${r.id}`} name={`points_${r.id}`} type="number" min={0} max={r.question.points} required className="input-base" /></Field>
                    <Field label={t("Feedback to learner")} htmlFor={`f-${r.id}`}><input id={`f-${r.id}`} name={`feedback_${r.id}`} className="input-base" /></Field>
                  </div>
                </div>
              ))}
              <div className="mt-3"><Field label={t("Overall feedback")} htmlFor={`o-${a.id}`}><textarea id={`o-${a.id}`} name="feedback" rows={2} className="input-base" /></Field></div>
              <div className="mt-3"><SubmitButton size="sm">{t("Record grade")}</SubmitButton></div>
            </ActionForm>
          ))}
        </Panel>

        <Panel title={t("Practical submissions awaiting review")} bodyClassName={submissions.length ? "p-0" : undefined}>
          {submissions.length === 0 ? <EmptyState title={t("No submissions waiting")} /> : submissions.map((s) => (
            <ActionForm key={s.id} action={reviewSubmissionAction} className="border-b border-line px-5 py-5 last:border-0">
              <input type="hidden" name="submissionId" value={s.id} />
              <p className="type-eyebrow">{s.lesson.module.course.code} · {s.lesson.title}</p>
              <p className="font-sans text-sm font-semibold">{s.user.name} <span className="font-normal text-ink-muted">{t("· submitted {date}", { date: fmtDate(s.submittedAt) })}</span></p>
              <p className="mt-2 whitespace-pre-line text-[0.9375rem]">{s.body}</p>
              {s.file && <p className="mt-1"><a href={`/api/v1/files/${s.file.id}`}>{s.file.originalName}</a></p>}
              <div className="mt-3"><Field label={t("Feedback (required when requesting revision)")} htmlFor={`sf-${s.id}`}><textarea id={`sf-${s.id}`} name="feedback" rows={2} className="input-base" /></Field></div>
              <div className="mt-3 flex gap-2"><SubmitButton size="sm" name="decision" value="approve">{t("Approve")}</SubmitButton><SubmitButton size="sm" variant="secondary" name="decision" value="revise">{t("Request revision")}</SubmitButton></div>
            </ActionForm>
          ))}
        </Panel>

        <Panel title={t("My courses")} bodyClassName="pt-0">
          {courses.length === 0 ? <div className="pt-4"><EmptyState title={t("No courses assigned to you")} /></div> : (
            <Table caption={t("Courses")}>
              <thead><tr><Th>{t("Course")}</Th><Th>{t("Status")}</Th><Th align="right">{t("Active learners")}</Th><Th align="right">{t("Completions")}</Th><Th /></tr></thead>
              <tbody>{courses.map((c) => <tr key={c.id}><Td><Link href={`/courses/${c.slug}`} className="font-medium">{c.title}</Link><div className="type-meta">{c.instructors.length ? t("{code} · you are an instructor", { code: c.code }) : c.code}</div></Td><Td><Status tone={COURSE_STATUS[c.status][1]}>{COURSE_STATUS[c.status][0]}</Status></Td><Td align="right">{c._count.enrollments}</Td><Td align="right">{c._count.completions}</Td><Td align="right"><LinkButton href={`/admin/courses/${c.id}?tab=curriculum`} size="sm" variant="secondary">{t("Edit content")}</LinkButton></Td></tr>)}</tbody>
            </Table>
          )}
        </Panel>

        <Panel title={t("Recent webinars — attendance")} description={t("Record and verify attendance after each session. Registration alone is never treated as attendance.")} bodyClassName="pt-0">
          {webinars.length === 0 ? <p className="pt-4 type-meta">{t("No recent webinars.")}</p> : (
            <Table caption={t("Recent webinars")}>
              <thead><tr><Th>{t("Webinar")}</Th><Th>{t("Date")}</Th><Th align="right">{t("Registered")}</Th><Th align="right">{t("Attendance recorded")}</Th><Th /></tr></thead>
              <tbody>{webinars.map((w) => <tr key={w.id}><Td className="font-medium">{w.title}</Td><Td>{fmtDateTime(w.startsAt, w.timeZone)}</Td><Td align="right">{w._count.registrations}</Td><Td align="right">{w._count.attendance}</Td><Td align="right"><LinkButton href={`/admin/webinars/${w.id}?tab=attendance`} size="sm" variant="secondary">{t("Record attendance")}</LinkButton></Td></tr>)}</tbody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
