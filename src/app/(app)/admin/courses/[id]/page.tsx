import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can, canManageCourse } from "@/server/policy";
import { publishErrors } from "@/server/services/admin-courses";
import { courseProgress } from "@/lib/domain/progress";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, Notice, PageHeader, Panel, Progress, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS, ENROLLMENT, ENROLMENT_RULE, LESSON_TYPE } from "@/lib/status";
import { fmtDate, fmtMinutes } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { tr } from "@/i18n/active";
import { CourseDetailsForm } from "../../course-form";
import { assessmentAction, courseRulesAction, courseStatusAction, lessonAction, moduleAction, questionAction } from "../../../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Edit course") };
}

const editorInclude = {
  departments: true,
  audiences: true,
  modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { resources: { include: { file: true } }, assessment: true } } } },
  assessments: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { responses: true } } } }, _count: { select: { attempts: true } } } },
  prerequisites: true,
  instructors: true,
  competencies: true,
} satisfies Prisma.CourseInclude;

const LESSON_TYPES = ["TEXT", "PDF", "DOCUMENT", "VIDEO", "EXTERNAL", "ASSESSMENT", "ASSIGNMENT"] as const;
const QUESTION_TYPE = (): Record<string, string> => ({ MULTIPLE_CHOICE: tr("multiple choice"), TRUE_FALSE: tr("true false"), SHORT_ANSWER: tr("short answer") });

export default async function CourseEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const actor = await requirePagePermission("course.manage", "course.teach");
  const { id } = await params;
  const { tab = "details", created } = await searchParams;
  const { t } = await getI18n();
  if (!(await canManageCourse(actor, id))) notFound();
  const course = await prisma.course.findUnique({ where: { id }, include: editorInclude });
  if (!course) notFound();
  const admin = can(actor, "course.manage");
  const errors = await publishErrors(id);
  const [label, tone] = COURSE_STATUS[course.status];
  const base = `/admin/courses/${id}`;
  const tabs = [
    { key: "details", label: t("Details"), href: base },
    { key: "curriculum", label: t("Modules and lessons"), href: `${base}?tab=curriculum` },
    { key: "assessments", label: t("Assessments"), href: `${base}?tab=assessments`, count: course.assessments.length },
    ...(admin ? [{ key: "rules", label: t("Completion, CPD and enrolment"), href: `${base}?tab=rules` }] : []),
    { key: "enrolments", label: t("Enrolments"), href: `${base}?tab=enrolments` },
  ];
  const statusBtn = (to: string, text: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <ActionForm action={courseStatusAction} inline><input type="hidden" name="courseId" value={id} /><input type="hidden" name="to" value={to} /><SubmitButton variant={variant} confirm={confirm}>{text}</SubmitButton></ActionForm>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: admin ? t("Course Management") : t("Teaching"), href: admin ? "/admin/courses" : "/teaching" }, { label: course.code }]}
        eyebrow={t("Course editor · {code}", { code: course.code })}
        title={course.title}
        meta={<><Status tone={tone}>{label}</Status><span>{t("Updated {date}", { date: fmtDate(course.updatedAt) })}</span><Link href={`/courses/${course.slug}`}>{t("View as learner")}</Link><Link href={`/learn/${course.slug}`}>{t("Preview player")}</Link></>}
        actions={
          <>
            {course.status === "DRAFT" && statusBtn("IN_REVIEW", t("Submit for review"))}
            {admin && (course.status === "DRAFT" || course.status === "IN_REVIEW") && statusBtn("PUBLISHED", t("Publish"), "primary")}
            {admin && course.status === "PUBLISHED" && statusBtn("DRAFT", t("Unpublish"), "secondary", t("Unpublish this course? Enrolled learners keep their records but new enrolments stop."))}
            {admin && course.status !== "ARCHIVED" && statusBtn("ARCHIVED", t("Archive"), "danger", t("Archive this course? It will be removed from the catalogue."))}
            {admin && course.status === "ARCHIVED" && statusBtn("DRAFT", t("Restore to draft"))}
          </>
        }
      />
      {created && <div className="mb-6"><Notice tone="ok">{t("Draft created. Add modules and lessons next.")}</Notice></div>}
      {course.status !== "PUBLISHED" && course.status !== "ARCHIVED" && (
        <div className="mb-6">
          {errors.length ? <Notice tone="warn" title={t("Before publishing")}>{errors.map((e) => <span key={e} className="block">• {e}</span>)}</Notice> : <Notice tone="ok" title={t("Ready to publish")}>{t("All completion rules can be satisfied by the current content.")}</Notice>}
        </div>
      )}
      <TabNav tabs={tabs} current={tab} />

      {tab === "details" && <Panel><CourseDetailsForm course={course} departmentIds={course.departments.map((d) => d.departmentId)} audienceRoleIds={course.audiences.map((a) => a.jobRoleId)} canSetAudience={can(actor, "course.manage")} /></Panel>}
      {tab === "curriculum" && <Curriculum course={course} />}
      {tab === "assessments" && <Assessments course={course} />}
      {tab === "rules" && admin && <Rules course={course} />}
      {tab === "enrolments" && <Enrolments courseId={id} />}
    </div>
  );
}

type CourseFull = Prisma.CourseGetPayload<{ include: typeof editorInclude }>;

function LessonFields({ lesson, assessments, uid }: { lesson?: CourseFull["modules"][number]["lessons"][number]; assessments: CourseFull["assessments"]; uid: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2"><Field label={tr("Lesson title")} htmlFor={`t-${uid}`} required><input id={`t-${uid}`} name="title" defaultValue={lesson?.title} required className="input-base" /></Field></div>
      <Field label={tr("Type")} htmlFor={`ty-${uid}`}><select id={`ty-${uid}`} name="type" defaultValue={lesson?.type ?? "TEXT"} className="input-base">{LESSON_TYPES.map((t) => <option key={t} value={t}>{LESSON_TYPE[t]}</option>)}</select></Field>
      <Field label={tr("Duration (minutes)")} htmlFor={`d-${uid}`}><input id={`d-${uid}`} name="durationMinutes" type="number" min={1} defaultValue={lesson?.durationMinutes ?? ""} className="input-base" /></Field>
      <div className="md:col-span-4"><Field label={tr("Content (Markdown: ## headings, - lists, **bold**) or assignment brief")} htmlFor={`b-${uid}`}><textarea id={`b-${uid}`} name="body" rows={6} defaultValue={lesson?.body ?? ""} className="input-base font-mono text-[0.8125rem]" /></Field></div>
      <div className="md:col-span-2"><Field label={tr("Video URL (video lessons)")} htmlFor={`v-${uid}`} hint={tr("Use an approved, access-controlled streaming source.")}><input id={`v-${uid}`} name="videoUrl" type="url" defaultValue={lesson?.videoUrl ?? ""} className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label={tr("External URL (external resources)")} htmlFor={`x-${uid}`}><input id={`x-${uid}`} name="externalUrl" type="url" defaultValue={lesson?.externalUrl ?? ""} className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label={tr("Assessment (assessment lessons)")} htmlFor={`a-${uid}`}><select id={`a-${uid}`} name="assessmentId" defaultValue={lesson?.assessmentId ?? ""} className="input-base"><option value="">—</option>{assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></Field></div>
      <div className="md:col-span-2"><Field label={tr("Attach material (PDF, Office, image; private storage)")} htmlFor={`r-${uid}`}><input id={`r-${uid}`} name="resource" type="file" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt" className="block font-sans text-sm" /></Field><input name="resourceLabel" placeholder={tr("Material label")} aria-label={tr("Material label")} className="input-base mt-2" /></div>
      <label className="flex items-center gap-2 font-sans text-sm md:col-span-4"><input type="checkbox" name="isRequired" defaultChecked={lesson?.isRequired ?? true} className="h-4 w-4 accent-[rgb(22,38,68)]" />{tr("Required for completion")}</label>
    </div>
  );
}

function Curriculum({ course }: { course: CourseFull }) {
  const op = (moduleId: string, o: string, label: string, confirm?: string) => (
    <ActionForm action={moduleAction} inline><input type="hidden" name="moduleId" value={moduleId} /><input type="hidden" name="op" value={o} /><SubmitButton size="sm" variant={o === "delete" ? "danger" : "ghost"} confirm={confirm}>{label}</SubmitButton></ActionForm>
  );
  const lop = (lessonId: string, o: string, label: string, confirm?: string) => (
    <ActionForm action={lessonAction} inline><input type="hidden" name="lessonId" value={lessonId} /><input type="hidden" name="op" value={o} /><SubmitButton size="sm" variant={o === "delete" ? "danger" : "ghost"} confirm={confirm}>{label}</SubmitButton></ActionForm>
  );
  return (
    <div className="space-y-6">
      {course.modules.map((m, mi) => (
        <Panel key={m.id} title={`${mi + 1}. ${m.title}`} description={m.description ?? undefined} actions={<>{mi > 0 && op(m.id, "up", tr("Move up"))}{mi < course.modules.length - 1 && op(m.id, "down", tr("Move down"))}{op(m.id, "delete", tr("Delete"), tr("Delete this module and its lessons?"))}</>} bodyClassName="p-0">
          <ul>
            {m.lessons.map((l, li) => (
              <li key={l.id} className="border-b border-line px-5 py-3 last:border-0">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <span className="text-[0.875rem]"><span className="font-medium">{l.title}</span> <span className="type-meta">· {LESSON_TYPE[l.type]} · {fmtMinutes(l.durationMinutes)}{!l.isRequired && ` · ${tr("optional")}`}{l.resources.length ? ` · ${tr("{count, plural, one {# file} other {# files}}", { count: l.resources.length })}` : ""}{l.assessment ? ` · ${l.assessment.title}` : ""}</span></span>
                    <span className="flex gap-1">{li > 0 && lop(l.id, "up", "↑")}{li < m.lessons.length - 1 && lop(l.id, "down", "↓")}<span className="font-sans text-[0.8125rem] text-navy-700">{tr("Edit")}</span></span>
                  </summary>
                  <ActionForm action={lessonAction} className="mt-4 space-y-3">
                    <input type="hidden" name="moduleId" value={m.id} /><input type="hidden" name="lessonId" value={l.id} /><input type="hidden" name="op" value="save" />
                    <LessonFields lesson={l} assessments={course.assessments} uid={l.id} />
                    <SubmitButton size="sm">{tr("Save lesson")}</SubmitButton>
                  </ActionForm>
                  {l.resources.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[0.8125rem]">{l.resources.map((r) => <li key={r.id} className="flex items-center gap-2"><a href={`/api/v1/files/${r.file.id}`}>{r.label}</a><span className="type-meta">{r.file.originalName}</span><ActionForm action={lessonAction} inline><input type="hidden" name="resourceId" value={r.id} /><input type="hidden" name="op" value="removeResource" /><SubmitButton size="sm" variant="ghost">{tr("Remove")}</SubmitButton></ActionForm></li>)}</ul>
                  )}
                  <div className="mt-3">{lop(l.id, "delete", tr("Delete lesson"), tr("Delete this lesson?"))}</div>
                </details>
              </li>
            ))}
          </ul>
          <details className="border-t border-line bg-canvas/50 px-5 py-3">
            <summary className="cursor-pointer font-sans text-sm font-medium text-navy-700">{tr("Add lesson to this module")}</summary>
            <ActionForm action={lessonAction} className="mt-3 space-y-3" resetOnSuccess>
              <input type="hidden" name="moduleId" value={m.id} /><input type="hidden" name="op" value="save" />
              <LessonFields assessments={course.assessments} uid={`new-${m.id}`} />
              <SubmitButton size="sm">{tr("Add lesson")}</SubmitButton>
            </ActionForm>
          </details>
          <details className="border-t border-line px-5 py-3">
            <summary className="cursor-pointer font-sans text-[0.8125rem] text-ink-muted">{tr("Rename module")}</summary>
            <ActionForm action={moduleAction} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="moduleId" value={m.id} /><input type="hidden" name="op" value="update" />
              <input name="title" defaultValue={m.title} aria-label={tr("Module title")} className="input-base" /><input name="description" defaultValue={m.description ?? ""} aria-label={tr("Module description")} className="input-base" /><SubmitButton size="sm" variant="secondary">{tr("Save")}</SubmitButton>
            </ActionForm>
          </details>
        </Panel>
      ))}
      <Panel title={tr("Add a module")}>
        <ActionForm action={moduleAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" resetOnSuccess>
          <input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="op" value="add" />
          <input name="title" placeholder={tr("Module title")} aria-label={tr("Module title")} required className="input-base" /><input name="description" placeholder={tr("Short description")} aria-label={tr("Module description")} className="input-base" /><SubmitButton size="sm">{tr("Add module")}</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}

function AssessmentFields({ a, uid }: { a?: CourseFull["assessments"][number]; uid: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2"><Field label={tr("Title")} htmlFor={`at-${uid}`} required><input id={`at-${uid}`} name="title" defaultValue={a?.title} required className="input-base" /></Field></div>
      <Field label={tr("Pass mark (%)")} htmlFor={`ap-${uid}`}><input id={`ap-${uid}`} name="passingScore" type="number" min={1} max={100} defaultValue={a?.passingScore ?? 70} className="input-base" /></Field>
      <Field label={tr("Attempts (0 = unlimited)")} htmlFor={`aa-${uid}`}><input id={`aa-${uid}`} name="maxAttempts" type="number" min={0} max={20} defaultValue={a?.maxAttempts ?? 3} className="input-base" /></Field>
      <div className="md:col-span-3"><Field label={tr("Description")} htmlFor={`ad-${uid}`}><input id={`ad-${uid}`} name="description" defaultValue={a?.description ?? ""} className="input-base" /></Field></div>
      <label className="flex items-end gap-2 pb-2 font-sans text-sm"><input type="checkbox" name="isFinal" defaultChecked={a?.isFinal ?? true} className="h-4 w-4 accent-[rgb(22,38,68)]" />{tr("Counts for completion")}</label>
    </div>
  );
}

function Assessments({ course }: { course: CourseFull }) {
  return (
    <div className="space-y-6">
      {course.assessments.map((a) => (
        <Panel key={a.id} title={a.title} description={[tr("{count, plural, one {# question} other {# questions}}", { count: a.questions.length }), tr("pass mark {score}%", { score: a.passingScore }), a.maxAttempts ? tr("{count, plural, one {# attempt} other {# attempts}}", { count: a.maxAttempts }) : tr("unlimited attempts"), tr("{count, plural, one {# attempt recorded} other {# attempts recorded}}", { count: a._count.attempts }), ...(a.isFinal ? [tr("final assessment")] : [])].join(" · ")}>
          <details className="mb-4">
            <summary className="cursor-pointer font-sans text-sm text-navy-700">{tr("Edit assessment settings")}</summary>
            <ActionForm action={assessmentAction} className="mt-3 space-y-3"><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="assessmentId" value={a.id} /><AssessmentFields a={a} uid={a.id} /><SubmitButton size="sm">{tr("Save")}</SubmitButton></ActionForm>
          </details>
          <ol className="space-y-3">
            {a.questions.map((q, i) => (
              <li key={q.id} className="rounded border border-line p-3 text-[0.875rem]">
                <div className="flex justify-between gap-3"><span><b className="font-sans">{i + 1}.</b> {q.prompt}</span><span className="shrink-0 type-meta">{QUESTION_TYPE()[q.type] ?? q.type.replace("_", " ").toLowerCase()} · {tr("{points} pt", { points: q.points })}</span></div>
                {q.type === "MULTIPLE_CHOICE" && <ul className="mt-1 ps-5 text-ink-muted">{(q.options as { id: string; text: string }[]).map((o) => <li key={o.id}>{o.id === q.correctOptionId ? "✓ " : "· "}{o.text}</li>)}</ul>}
                {q.type === "TRUE_FALSE" && <p className="mt-1 text-ink-muted">{tr("Correct: {answer}", { answer: q.correctBoolean ? tr("True") : tr("False") })}</p>}
                {q.guidance && <p className="mt-1 type-meta">{tr("Guidance: {text}", { text: q.guidance })}</p>}
                {q._count.responses === 0 ? (
                  <ActionForm action={questionAction} inline className="mt-2"><input type="hidden" name="questionId" value={q.id} /><input type="hidden" name="op" value="delete" /><SubmitButton size="sm" variant="ghost" confirm={tr("Remove this question?")}>{tr("Remove")}</SubmitButton></ActionForm>
                ) : <p className="mt-1 type-meta">{tr("{count, plural, one {# response recorded — locked to preserve assessment history.} other {# responses recorded — locked to preserve assessment history.}}", { count: q._count.responses })}</p>}
              </li>
            ))}
          </ol>
          <details className="mt-4 rounded border border-dashed border-line-strong p-4">
            <summary className="cursor-pointer font-sans text-sm font-medium text-navy-700">{tr("Add question")}</summary>
            <ActionForm action={questionAction} className="mt-3 grid gap-3 md:grid-cols-4" resetOnSuccess>
              <input type="hidden" name="assessmentId" value={a.id} />
              <Field label={tr("Type")} htmlFor={`qt-${a.id}`}><select id={`qt-${a.id}`} name="type" className="input-base"><option value="MULTIPLE_CHOICE">{tr("Multiple choice")}</option><option value="TRUE_FALSE">{tr("True / false")}</option><option value="SHORT_ANSWER">{tr("Short answer (instructor-graded)")}</option></select></Field>
              <Field label={tr("Points")} htmlFor={`qp-${a.id}`}><input id={`qp-${a.id}`} name="points" type="number" min={1} max={20} defaultValue={1} className="input-base" /></Field>
              <div className="md:col-span-4"><Field label={tr("Question")} htmlFor={`qq-${a.id}`} required><textarea id={`qq-${a.id}`} name="prompt" rows={2} required className="input-base" /></Field></div>
              {[0, 1, 2, 3, 4].map((i) => <input key={i} name={`option_${i}`} placeholder={tr("Option {letter} (multiple choice)", { letter: String.fromCharCode(65 + i) })} aria-label={tr("Option {letter}", { letter: String.fromCharCode(65 + i) })} className="input-base md:col-span-2" />)}
              <Field label={tr("Correct option (MC)")} htmlFor={`qc-${a.id}`}><select id={`qc-${a.id}`} name="correctIndex" className="input-base"><option value="">—</option>{[0, 1, 2, 3, 4].map((i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}</select></Field>
              <Field label={tr("Correct answer (T/F)")} htmlFor={`qb-${a.id}`}><select id={`qb-${a.id}`} name="correctBoolean" className="input-base"><option value="">—</option><option value="true">{tr("True")}</option><option value="false">{tr("False")}</option></select></Field>
              <div className="md:col-span-4"><Field label={tr("Marking guidance (short answer)")} htmlFor={`qg-${a.id}`}><input id={`qg-${a.id}`} name="guidance" className="input-base" /></Field></div>
              <div><SubmitButton size="sm">{tr("Add question")}</SubmitButton></div>
            </ActionForm>
          </details>
        </Panel>
      ))}
      <Panel title={tr("Create an assessment")} description={tr("After creating it, link it to an assessment lesson in Modules and lessons.")}>
        <ActionForm action={assessmentAction} className="space-y-3" resetOnSuccess><input type="hidden" name="courseId" value={course.id} /><AssessmentFields uid="new" /><SubmitButton size="sm">{tr("Create assessment")}</SubmitButton></ActionForm>
      </Panel>
    </div>
  );
}

async function Rules({ course }: { course: CourseFull }) {
  const { t } = await getI18n();
  const [courses, instructors, competencies] = await Promise.all([
    prisma.course.findMany({ where: { id: { not: course.id }, status: { not: "ARCHIVED" } }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    prisma.user.findMany({ where: { status: "ACTIVE", roles: { some: { role: { permissions: { some: { permission: { key: "course.teach" } } } } } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);
  const chk = (name: string, label: string, on: boolean, hint?: string) => (
    <label className="flex items-start gap-2 text-[0.875rem]"><input type="checkbox" name={name} defaultChecked={on} className="mt-1 h-4 w-4 accent-[rgb(22,38,68)]" /><span>{label}{hint && <span className="block type-meta">{hint}</span>}</span></label>
  );
  const linked = new Map(course.competencies.map((c) => [c.competencyId, c.targetLevel]));
  return (
    <ActionForm action={courseRulesAction} className="space-y-6">
      <input type="hidden" name="courseId" value={course.id} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Completion rules")} description={t("Completion is evaluated on the server. A certificate is issued only when every enabled rule is met.")}>
          <div className="space-y-2.5">
            {chk("requireAllLessons", t("All required lessons completed"), course.requireAllLessons)}
            {chk("requireAssessmentPass", t("Final assessment passed"), course.requireAssessmentPass)}
            {chk("requireAssignmentApproval", t("Practical assignment approved by an instructor"), course.requireAssignmentApproval)}
            {chk("requireAcknowledgement", t("Mandatory acknowledgement submitted"), course.requireAcknowledgement)}
            <Field label={t("Acknowledgement statement")} htmlFor="acknowledgementText"><textarea id="acknowledgementText" name="acknowledgementText" rows={2} defaultValue={course.acknowledgementText ?? ""} className="input-base" /></Field>
          </div>
        </Panel>
        <Panel title={t("Certification")}>
          <div className="space-y-3">
            {chk("certificateEnabled", t("Issue a certificate on completion"), course.certificateEnabled)}
            <Field label={t("Certificate validity (months)")} htmlFor="certificateValidityMonths" hint={t("Leave blank for no expiry.")}><input id="certificateValidityMonths" name="certificateValidityMonths" type="number" min={1} max={120} defaultValue={course.certificateValidityMonths ?? ""} className="input-base" /></Field>
            <Field label={t("Recertification requirements")} htmlFor="recertificationNote"><input id="recertificationNote" name="recertificationNote" defaultValue={course.recertificationNote ?? ""} className="input-base" /></Field>
          </div>
        </Panel>
        <Panel title={t("CPD")} description={t("The CPD value is configured explicitly. Estimated study time is never converted automatically.")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{chk("cpdEligible", t("CPD-eligible"), course.cpdEligible)}</div>
            <Field label={t("CPD value")} htmlFor="cpdValue"><input id="cpdValue" name="cpdValue" type="number" step="0.25" min={0} defaultValue={course.cpdValue ? Number(course.cpdValue) : ""} className="input-base" /></Field>
            <Field label={t("Unit")} htmlFor="cpdUnit"><select id="cpdUnit" name="cpdUnit" defaultValue={course.cpdUnit} className="input-base"><option value="HOURS">{t("Hours")}</option><option value="POINTS">{t("Points")}</option></select></Field>
            <div className="sm:col-span-2"><Field label={t("Accreditation note shown to learners")} htmlFor="cpdAccreditationNote"><input id="cpdAccreditationNote" name="cpdAccreditationNote" defaultValue={course.cpdAccreditationNote ?? ""} className="input-base" /></Field></div>
          </div>
        </Panel>
        <Panel title={t("Enrolment")}>
          <div className="space-y-3">
            <Field label={t("Enrolment rule")} htmlFor="enrolmentRule"><select id="enrolmentRule" name="enrolmentRule" defaultValue={course.enrolmentRule} className="input-base">{Object.entries(ENROLMENT_RULE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {chk("isMandatory", t("Flag as mandatory training in the catalogue"), course.isMandatory, t("Mandatory requirements are created through Learning Assignment."))}
            <Field label={t("Prerequisite courses")} htmlFor="prerequisiteIds" hint={t("Hold Ctrl/Cmd to select several.")}><select id="prerequisiteIds" name="prerequisiteIds" multiple size={6} defaultValue={course.prerequisites.map((p) => p.prerequisiteId)} className="input-base">{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></Field>
            <Field label={t("Instructors (first selected is lead)")} htmlFor="instructorIds"><select id="instructorIds" name="instructorIds" multiple size={5} defaultValue={course.instructors.map((i) => i.userId)} className="input-base">{instructors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          </div>
        </Panel>
      </div>
      <Panel title={t("Competencies developed")} description={t("Course completion records knowledge evidence at the target level. Whether it counts as competence is set by the framework.")}>
        <div className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
          {competencies.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[0.8125rem]">
              <input type="checkbox" name="competencyIds" value={c.id} id={`cc-${c.id}`} defaultChecked={linked.has(c.id)} className="h-4 w-4 accent-[rgb(22,38,68)]" />
              <label htmlFor={`cc-${c.id}`} className="flex-1">{c.code} {c.name}</label>
              <label htmlFor={`lv-${c.id}`} className="sr-only">{t("Target level for {name}", { name: c.name })}</label>
              <select id={`lv-${c.id}`} name={`level_${c.id}`} defaultValue={linked.get(c.id) ?? 2} className="input-base h-8 w-16 !py-0">{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}</select>
            </div>
          ))}
        </div>
      </Panel>
      <SubmitButton>{t("Save rules")}</SubmitButton>
    </ActionForm>
  );
}

async function Enrolments({ courseId }: { courseId: string }) {
  const { t } = await getI18n();
  const rows = await prisma.enrollment.findMany({
    where: { courseId },
    orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
    include: { user: { select: { name: true, profile: { select: { department: { select: { name: true } } } } } }, lessonProgress: { where: { completedAt: { not: null } }, select: { lessonId: true } }, completion: { include: { certificate: true } }, course: { include: { modules: { include: { lessons: { select: { id: true, isRequired: true } } } } } } },
    take: 300,
  });
  const lessons = rows[0]?.course.modules.flatMap((m) => m.lessons) ?? [];
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  return (
    <div className="space-y-4">
      <p className="type-meta">{t("{count, plural, one {# enrolment} other {# enrolments}} · {completed} completed ({percent}%)", { count: rows.length, completed, percent: rows.length ? Math.round((completed / rows.length) * 100) : 0 })}</p>
      <Panel bodyClassName="pt-0">
        <Table caption={t("Enrolments")}>
          <thead><tr><Th>{t("Learner")}</Th><Th>{t("Status")}</Th><Th>{t("Progress")}</Th><Th>{t("Enrolled")}</Th><Th>{t("Last accessed")}</Th><Th>{t("Completed")}</Th><Th>{t("Certificate")}</Th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><Td className="font-medium">{r.user.name}<div className="type-meta">{r.user.profile?.department?.name}{r.cycle > 1 ? ` · ${t("cycle {n}", { n: r.cycle })}` : ""}</div></Td><Td><Status tone={ENROLLMENT[r.status][1]}>{ENROLLMENT[r.status][0]}</Status></Td><Td className="w-36"><Progress value={r.status === "COMPLETED" ? 100 : courseProgress(lessons, r.lessonProgress.map((p) => p.lessonId)).percent} label={t("Progress")} /></Td><Td>{fmtDate(r.enrolledAt)}</Td><Td>{fmtDate(r.lastAccessedAt)}</Td><Td>{fmtDate(r.completedAt)}</Td><Td className="font-mono text-[0.75rem]">{r.completion?.certificate?.serial ?? "—"}</Td></tr>)}</tbody>
        </Table>
      </Panel>
      <LinkButton href="/admin/reports" variant="secondary" size="sm">{t("Organisation reports")}</LinkButton>
    </div>
  );
}
