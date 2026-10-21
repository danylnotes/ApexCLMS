import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Download, ExternalLink, Lock } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { getPlayer, completionState, assessmentStatus } from "@/server/services/learning";
import { evaluateCompletion } from "@/lib/domain/completion";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs, LinkButton, Notice, Panel, Progress, Status } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { LESSON_TYPE } from "@/lib/status";
import { fmtDate, fmtMinutes } from "@/lib/format";
import { acknowledgeAction, completeLessonAction, submitAssessmentAction, submitAssignmentAction } from "../../learner-actions";
import { LessonTracker, TrackedVideo } from "./tracker";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Course player") };
}

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const { slug } = await params;
  const { lesson: lessonParam } = await searchParams;
  let data;
  try {
    data = await getPlayer(actor, slug);
  } catch (e) {
    if (e instanceof AppError && e.code === "FORBIDDEN") {
      return (
        <div className="mx-auto max-w-xl py-10">
          <Notice tone="warn" title={t("Enrolment required")}>{e.message}</Notice>
          <div className="mt-4"><LinkButton href={`/courses/${slug}`}>{t("View course details")}</LinkButton></div>
        </div>
      );
    }
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { course, enrollment, preview } = data;
  const lessons = course.modules.flatMap((m) => m.lessons);
  const done = new Set(enrollment?.lessonProgress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const current = lessons.find((l) => l.id === lessonParam) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
  if (!current) notFound();
  const idx = lessons.findIndex((l) => l.id === current.id);
  const next = lessons[idx + 1];
  const prev = lessons[idx - 1];
  const progressRow = enrollment?.lessonProgress.find((p) => p.lessonId === current.id);
  const state = enrollment ? await completionState(enrollment.id) : null;
  const evaluation = state ? evaluateCompletion(state.course, state.state) : null;
  const active = !!enrollment && !preview;
  const nextHref = next ? `/learn/${course.slug}?lesson=${next.id}` : `/learn/${course.slug}?lesson=${current.id}`;

  // Assessment / assignment context
  const assessment = current.type === "ASSESSMENT" && current.assessmentId
    ? await prisma.assessment.findUnique({ where: { id: current.assessmentId }, include: { questions: { orderBy: { sortOrder: "asc" } } } })
    : null;
  const aStatus = assessment && enrollment ? await assessmentStatus(actor.id, enrollment.id, assessment.id, assessment.maxAttempts) : null;
  const lastAttempt = aStatus?.attempts.at(-1)
    ? await prisma.assessmentAttempt.findUnique({ where: { id: aStatus.attempts.at(-1)!.id }, include: { responses: true } })
    : null;
  const submissions = current.type === "ASSIGNMENT" && enrollment
    ? await prisma.assignmentSubmission.findMany({ where: { lessonId: current.id, enrollmentId: enrollment.id }, orderBy: { submittedAt: "desc" }, include: { reviewer: { select: { name: true } }, file: { select: { id: true, originalName: true } } } })
    : [];

  return (
    <div>
      <LessonTracker lessonId={current.id} enabled={active && enrollment!.status === "ACTIVE"} />
      <Breadcrumbs items={[{ label: t("My Learning"), href: "/my-learning" }, { label: course.title, href: `/courses/${course.slug}` }, { label: current.title }]} />
      {preview && <div className="mb-4"><Notice tone="info" title={t("Preview mode")}>{t("You are previewing this course as a course manager. Progress is not recorded.")}</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* Course navigation */}
        <nav aria-label={t("Course contents")} className="lg:sticky lg:top-20 lg:self-start">
          <details className="rounded-[22px] bg-surface lg:open" open>
            <summary className="cursor-pointer list-none border-b border-line px-4 py-3 font-sans text-sm font-semibold lg:cursor-default [&::-webkit-details-marker]:hidden">
              {course.title}
              {state && <span className="mt-2 block"><Progress value={enrollment!.status === "COMPLETED" ? 100 : state.percent} label={t("Course progress")} size="sm" /></span>}
            </summary>
            <ol className="max-h-[70vh] overflow-y-auto py-2">
              {course.modules.map((m) => (
                <li key={m.id} className="mb-2">
                  <p className="px-4 py-1 type-eyebrow">{m.title}</p>
                  <ol>
                    {m.lessons.map((l) => {
                      const isCurrent = l.id === current.id;
                      return (
                        <li key={l.id}>
                          <Link
                            href={`/learn/${course.slug}?lesson=${l.id}`}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`flex items-start gap-2 px-4 py-1.5 font-sans text-[0.8125rem] no-underline ${isCurrent ? "bg-navy-50 font-medium text-navy" : "text-ink hover:bg-canvas"}`}
                          >
                            {done.has(l.id) ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-label={t("Completed")} /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-line-strong" aria-label={t("Not completed")} />}
                            <span>{l.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
          </details>
        </nav>

        {/* Main content */}
        <article className="min-w-0 rounded-[22px] bg-surface px-5 py-6 sm:px-10 sm:py-8">
          <p className="type-eyebrow">{LESSON_TYPE[current.type]} · {fmtMinutes(current.durationMinutes)}{!current.isRequired && ` · ${t("optional")}`}</p>
          <h1 className="type-display mt-1 !text-[1.625rem]">{current.title}</h1>
          <div className="mt-6">
            {current.type === "VIDEO" && current.videoUrl && <div className="mb-6"><TrackedVideo lessonId={current.id} src={current.videoUrl} start={progressRow?.videoPositionSeconds ?? null} /><p className="mt-2 type-meta">{t("Viewing position is saved periodically. Completion is confirmed when you mark the lesson complete.")}</p></div>}
            {current.body && current.type !== "ASSIGNMENT" && <Markdown source={current.body} />}
            {current.type === "EXTERNAL" && current.externalUrl && (
              <p className="mt-4"><a href={current.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-sans text-sm font-medium">{t("Open external resource")} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a><span className="ms-2 type-meta">{t("(opens a third-party site)")}</span></p>
            )}
            {current.resources.length > 0 && (
              <div className="mt-6 rounded border border-line bg-canvas/60 p-4">
                <h2 className="type-eyebrow mb-2">{t("Lesson materials")}</h2>
                <ul className="space-y-1.5">
                  {current.resources.map((r) => (
                    <li key={r.id}><a href={`/api/v1/files/${r.file.id}`} className="inline-flex items-center gap-2 font-sans text-sm"><Download className="h-4 w-4" aria-hidden />{r.label}<span className="type-meta">{t("({type}, {size} KB)", { type: r.file.mimeType === "application/pdf" ? "PDF" : t("file"), size: Math.round(r.file.sizeBytes / 1024) })}</span></a></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assessment */}
            {assessment && (
              <section aria-labelledby="assess-h" className="mt-2">
                <h2 id="assess-h" className="sr-only">{t("Assessment")}</h2>
                <dl className="mb-6 grid grid-cols-2 gap-4 rounded border border-line p-4 font-sans text-sm sm:grid-cols-4">
                  <div><dt className="type-eyebrow">{t("Questions")}</dt><dd>{assessment.questions.length}</dd></div>
                  <div><dt className="type-eyebrow">{t("Pass mark")}</dt><dd>{t("{percent}%", { percent: assessment.passingScore })}</dd></div>
                  <div><dt className="type-eyebrow">{t("Attempts")}</dt><dd>{t("{count} of {max}", { count: aStatus?.attempts.length ?? 0, max: assessment.maxAttempts || t("unlimited") })}</dd></div>
                  <div><dt className="type-eyebrow">{t("Status")}</dt><dd>{aStatus?.passed ? <Status tone="ok">{t("Passed")}</Status> : aStatus?.pending ? <Status tone="warn">{t("Awaiting review")}</Status> : <Status tone="idle">{t("Not passed")}</Status>}</dd></div>
                </dl>
                {aStatus && aStatus.attempts.length > 0 && (
                  <table className="mb-6 w-full font-sans text-[0.8125rem]">
                    <caption className="mb-1 text-start type-eyebrow">{t("Your attempts")}</caption>
                    <thead><tr className="border-b border-line text-start text-ink-faint"><th className="py-1 font-medium">{t("Attempt")}</th><th className="font-medium">{t("Submitted")}</th><th className="font-medium">{t("Score")}</th><th className="font-medium">{t("Result")}</th></tr></thead>
                    <tbody>
                      {aStatus.attempts.map((a) => (
                        <tr key={a.id} className="border-b border-line"><td className="py-1.5">{a.attemptNumber}</td><td>{fmtDate(a.submittedAt)}</td><td className="tabular-nums">{a.percent != null ? t("{percent}%", { percent: a.percent }) : "—"}</td><td>{a.status === "PENDING_REVIEW" ? t("Awaiting instructor review") : a.passed ? t("Passed") : t("Not passed")}{a.feedback && <span className="block text-ink-muted">{t("Feedback: {feedback}", { feedback: a.feedback })}</span>}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {active && aStatus?.eligibility.allowed ? (
                  <ActionForm action={submitAssessmentAction} className="space-y-6">
                    <input type="hidden" name="assessmentId" value={assessment.id} />
                    {assessment.questions.map((q, i) => (
                      <fieldset key={q.id} className="rounded border border-line p-4">
                        <legend className="px-1 font-sans text-[0.75rem] text-ink-faint">{t("Question {number} · {points, plural, one {# point} other {# points}}", { number: i + 1, points: q.points })}</legend>
                        <p className="mb-3 font-sans text-[0.9375rem] font-medium text-ink">{q.prompt}</p>
                        {q.type === "MULTIPLE_CHOICE" && (
                          <div className="space-y-2">
                            {(q.options as { id: string; text: string }[]).map((o) => (
                              <label key={o.id} className="flex cursor-pointer items-start gap-2.5 rounded px-2 py-1.5 text-[0.9375rem] hover:bg-canvas">
                                <input type="radio" name={`q_${q.id}`} value={o.id} required className="mt-1 h-4 w-4 accent-[rgb(22,38,68)]" />
                                {o.text}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.type === "TRUE_FALSE" && (
                          <div className="flex gap-6">
                            {["true", "false"].map((v) => (
                              <label key={v} className="flex cursor-pointer items-center gap-2 text-[0.9375rem]"><input type="radio" name={`q_${q.id}`} value={v} required className="h-4 w-4 accent-[rgb(22,38,68)]" />{v === "true" ? t("True") : t("False")}</label>
                            ))}
                          </div>
                        )}
                        {q.type === "SHORT_ANSWER" && (
                          <>
                            <label htmlFor={`q_${q.id}`} className="sr-only">{t("Your answer")}</label>
                            <textarea id={`q_${q.id}`} name={`q_${q.id}`} rows={4} required maxLength={5000} className="input-base" />
                            <p className="mt-1 type-meta">{t("Reviewed by the instructor.")}</p>
                          </>
                        )}
                      </fieldset>
                    ))}
                    <SubmitButton pendingLabel={t("Submitting…")} confirm={t("Submit your answers? This uses one attempt.")}>{t("Submit assessment")}</SubmitButton>
                  </ActionForm>
                ) : (
                  aStatus && !aStatus.eligibility.allowed && <Notice tone={aStatus.passed ? "ok" : "info"}>{aStatus.eligibility.reason}</Notice>
                )}
                {lastAttempt && lastAttempt.status === "GRADED" && (
                  <div className="mt-6">
                    <h3 className="type-eyebrow mb-2">{t("Latest attempt — question review")}</h3>
                    <ol className="space-y-1 font-sans text-[0.8125rem]">
                      {assessment.questions.map((q, i) => {
                        const r = lastAttempt.responses.find((x) => x.questionId === q.id);
                        return <li key={q.id} className="flex gap-2"><span className="w-6 text-ink-faint">{i + 1}.</span>{r?.isCorrect ? <span className="text-ok">● {t("Correct")}</span> : <span className="text-crit">■ {t("Incorrect")}</span>}<span className="truncate text-ink-muted">{q.prompt}</span></li>;
                      })}
                    </ol>
                  </div>
                )}
              </section>
            )}

            {/* Assignment */}
            {current.type === "ASSIGNMENT" && (
              <section aria-labelledby="assign-h">
                <h2 id="assign-h" className="type-section mb-2">{t("Assignment brief")}</h2>
                {current.body && <Markdown source={current.body} />}
                {submissions.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="type-eyebrow">{t("Your submissions")}</h3>
                    {submissions.map((s) => (
                      <div key={s.id} className="rounded border border-line p-4 text-[0.875rem]">
                        <div className="flex items-center justify-between gap-2"><span className="type-meta">{t("Submitted {date}", { date: fmtDate(s.submittedAt) })}</span><Status tone={s.status === "APPROVED" ? "ok" : s.status === "SUBMITTED" ? "warn" : "crit"}>{s.status === "APPROVED" ? t("Approved") : s.status === "SUBMITTED" ? t("Awaiting review") : t("Revision requested")}</Status></div>
                        <p className="mt-2 whitespace-pre-line">{s.body}</p>
                        {s.file && <p className="mt-1"><a href={`/api/v1/files/${s.file.id}`}>{s.file.originalName}</a></p>}
                        {s.feedback && <p className="mt-2 border-t border-line pt-2 text-ink-muted"><b className="text-ink">{s.reviewer?.name}:</b> {s.feedback}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {active && !submissions.some((s) => s.status !== "REVISION_REQUESTED") && (
                  <ActionForm action={submitAssignmentAction} className="mt-6 space-y-3" resetOnSuccess>
                    <input type="hidden" name="lessonId" value={current.id} />
                    <label htmlFor="body" className="block font-sans text-[0.8125rem] font-medium">{t("Your submission")}</label>
                    <textarea id="body" name="body" rows={7} required minLength={20} className="input-base" />
                    <label htmlFor="file" className="block font-sans text-[0.8125rem] font-medium">{t("Supporting file (optional — PDF, Office, image; max 10 MB)")}</label>
                    <input id="file" name="file" type="file" className="block font-sans text-sm" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv" />
                    <SubmitButton>{t("Submit for review")}</SubmitButton>
                  </ActionForm>
                )}
              </section>
            )}
          </div>

          {/* Lesson footer */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 no-print">
            {prev ? <LinkButton href={`/learn/${course.slug}?lesson=${prev.id}`} variant="secondary" size="sm">{t("← Previous")}</LinkButton> : <span />}
            <div className="flex items-center gap-2">
              {active && ["TEXT", "VIDEO", "PDF", "DOCUMENT", "EXTERNAL"].includes(current.type) && !done.has(current.id) && (
                <ActionForm action={completeLessonAction} inline>
                  <input type="hidden" name="lessonId" value={current.id} />
                  <input type="hidden" name="next" value={nextHref} />
                  <SubmitButton pendingLabel={t("Saving…")}>{next ? t("Mark complete and continue") : t("Mark complete")}</SubmitButton>
                </ActionForm>
              )}
              {(done.has(current.id) || !active || ["ASSESSMENT", "ASSIGNMENT"].includes(current.type)) && next && <LinkButton href={nextHref} variant={done.has(current.id) ? "primary" : "secondary"} size="sm">{t("Next →")}</LinkButton>}
            </div>
          </div>
        </article>

        {/* Context */}
        <aside className="min-w-0 space-y-4 lg:col-start-2 2xl:col-start-auto">
          {evaluation && (
            <Panel title={t("Completion requirements")}>
              <ul className="space-y-2.5">
                {evaluation.checks.map((c) => (
                  <li key={c.rule} className="flex gap-2 text-[0.8125rem]">
                    {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /> : <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />}
                    <span><span className="font-medium text-ink">{c.label}</span><span className="sr-only">{c.met ? ` — ${t("met")}` : ` — ${t("not yet met")}`}</span><br /><span className="text-ink-muted">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
              {enrollment?.status === "COMPLETED" ? (
                <p className="mt-4 border-t border-line pt-3 text-[0.8125rem] text-ok">● {t("Completed {date}.", { date: fmtDate(enrollment.completedAt) })} <Link href="/certificates">{t("View certificate")}</Link></p>
              ) : (
                <p className="mt-4 border-t border-line pt-3 type-meta">{t("Completion is confirmed by the server once every requirement is met.")}</p>
              )}
            </Panel>
          )}
          {active && course.requireAcknowledgement && !enrollment!.acknowledgedAt && (
            <Panel title={t("Acknowledgement")}>
              <ActionForm action={acknowledgeAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <label className="flex gap-2 text-[0.875rem]"><input type="checkbox" name="confirm" className="mt-1 h-4 w-4 accent-[rgb(22,38,68)]" />{course.acknowledgementText}</label>
                <div className="mt-3"><SubmitButton size="sm">{t("Record acknowledgement")}</SubmitButton></div>
              </ActionForm>
            </Panel>
          )}
          {progressRow && <p className="type-meta">{t("Time recorded on this lesson: {time}", { time: fmtMinutes(Math.round(progressRow.timeSpentSeconds / 60)) })}</p>}
        </aside>
      </div>
    </div>
  );
}
