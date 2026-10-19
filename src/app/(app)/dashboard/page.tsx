import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { employeeOverview, developmentPriorities } from "@/server/services/overview";
import { prisma } from "@/server/db";
import { HealthTable } from "@/components/health";
import { EmptyState, LinkButton, Metric, MetricRow, Panel, Progress, Status } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtMinutes, fmtNum, fmtRelative } from "@/lib/format";
import { mandatoryState } from "@/lib/domain/compliance";
import { MANDATORY } from "@/lib/status";
import { COMPLIANCE_METHOD } from "@/lib/domain/compliance";

export const metadata = { title: "Dashboard" };

const ACTIVITY_LABEL: Record<string, string> = {
  COURSE_COMPLETED: "Course completed",
  ASSESSMENT_PASSED: "Assessment passed",
  ASSESSMENT_FAILED: "Assessment attempted",
  ASSESSMENT_SUBMITTED: "Assessment submitted",
  WEBINAR_ATTENDED: "Webinar attended",
  WEBINAR_REGISTERED: "Webinar registration",
  CPD_APPROVED: "CPD approved",
  CPD_SUBMITTED: "CPD submitted",
  CPD_REJECTED: "CPD decision",
  CERTIFICATE_ISSUED: "Certificate issued",
  COMPETENCY_ASSESSED: "Competency assessed",
  PLAN_REVIEWED: "Plan reviewed",
  ENROLLED: "Enrolled",
  LESSON_COMPLETED: "Lesson completed",
  PATH_STARTED: "Learning path started",
};

export default async function DashboardPage() {
  const actor = await requireActor();
  const o = await employeeOverview(actor.id);
  const priorities = developmentPriorities(o);
  const timeline = await prisma.learningActivityEvent.findMany({
    where: { userId: actor.id, type: { notIn: ["LESSON_COMPLETED", "ENROLLED"] } },
    orderBy: { occurredAt: "desc" },
    take: 8,
  });
  const p = o.profile;
  const year = o.computedAt.getUTCFullYear();
  const unitLabel = o.metrics.cpdUnit === "POINTS" ? "points" : "hours";
  const upcomingDeadlines = o.assignments
    .filter((a) => a.status === "ASSIGNED" && a.dueDate)
    .slice(0, 5);
  const firstName = actor.name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "").split(" ")[0];

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <section aria-labelledby="welcome" className="border-b border-line pb-7">
        <p className="type-eyebrow">Your development overview · {o.cpd.period?.name ?? year} development period</p>
        <h1 id="welcome" className="type-display mt-1.5">Welcome back, {firstName}</h1>
        <p className="mt-2 max-w-3xl text-[0.975rem] text-ink-muted">
          Track your learning, strengthen your technical competencies, and prepare for your next career milestone.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-sans text-[0.8125rem]">
          {[
            ["Role", p?.jobRole?.title],
            ["Department", p?.department?.name],
            ["Business unit", p?.businessUnit?.name],
            ["Programme", p?.learningProgramme],
            ["Target role", p?.targetJobRole?.title],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="font-medium text-ink">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Personal learning summary */}
      <section aria-labelledby="summary">
        <h2 id="summary" className="sr-only">Personal learning summary</h2>
        <MetricRow cols={7}>
          <Metric
            label="Overall learning progress"
            value={o.metrics.overallPercent == null ? "—" : `${o.metrics.overallPercent}%`}
            context={`across ${o.courseRows.length} enrolment${o.courseRows.length === 1 ? "" : "s"}`}
            definition="Average completion of required lessons across all your active and completed enrolments."
          />
          <Metric label="Courses completed" value={o.metrics.coursesCompleted} context={`total · ${o.metrics.coursesCompletedThisYear} in ${year}`} definition="Courses whose completion rules you have satisfied. Cumulative total, with the current calendar year shown separately." />
          <Metric label="Courses in progress" value={o.metrics.coursesInProgress} context="active now" definition="Enrolments that are active and not yet completed." />
          <Metric
            label={`CPD ${unitLabel} approved`}
            value={o.metrics.cpdApproved == null ? "—" : fmtNum(o.metrics.cpdApproved)}
            context={o.metrics.cpdTarget != null ? `of ${o.metrics.cpdTarget} target · ${o.cpd.period?.name}` : o.cpd.policy ? "no target set" : "no CPD policy"}
            definition="Approved CPD claims in the current reporting period only. Pending and rejected claims are excluded."
          />
          <Metric label="Webinars attended" value={o.metrics.webinarsAttended} context={`total · ${o.metrics.webinarsAttendedThisYear} in ${year}`} definition="Webinars with a recorded attendance. Registration alone does not count." />
          <Metric
            label="Mandatory compliance"
            value={o.metrics.compliancePercent == null ? "—" : `${o.metrics.compliancePercent}%`}
            context={o.compliance.overdue ? `${o.compliance.overdue} overdue` : o.compliance.total ? `${o.compliance.completed}/${o.compliance.total} complete` : "none assigned"}
            tone={o.compliance.overdue ? "crit" : o.compliance.dueSoon ? "warn" : undefined}
            definition={COMPLIANCE_METHOD}
          />
          <Metric
            label="Competency coverage"
            value={o.metrics.competencyCoverage == null ? "—" : `${o.metrics.competencyCoverage}%`}
            context={o.competency.rows.length ? `${o.competency.summary.met}/${o.competency.summary.required} role requirements` : "no role requirements"}
            definition="Competency requirements of your current role met at the required level by a current, demonstrated assessment. Knowledge-only evidence (e.g. course completion) does not count under the current framework."
          />
        </MetricRow>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {/* Continue learning */}
          <Panel id="continue" title="Continue learning" description="Active courses, prioritising those approaching their due date." actions={<LinkButton href="/my-learning" variant="ghost" size="sm">All learning</LinkButton>} bodyClassName="p-0">
            {o.continueLearning.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No courses in progress" action={<LinkButton href="/catalogue" variant="secondary" size="sm">Browse the catalogue</LinkButton>}>
                  Enrol in a course or start an assigned course to see it here.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {o.continueLearning.slice(0, 4).map((r) => (
                  <li key={r.enrollment.id} className="grid items-center gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <div className="min-w-0">
                      <p className="type-eyebrow">{r.course.category.name} · {r.course.code}</p>
                      <Link href={`/courses/${r.course.slug}`} className="mt-0.5 block truncate font-sans text-[0.9375rem] font-semibold text-ink no-underline hover:text-navy hover:underline">
                        {r.course.title}
                      </Link>
                      <p className="mt-0.5 type-meta">
                        {r.course.instructors[0]?.user.name ?? r.course.provider} · Last accessed {fmtRelative(r.enrollment.lastAccessedAt)}
                        {r.enrollment.dueDate && (
                          <>
                            {" · "}
                            <span className={r.enrollment.dueDate < o.computedAt ? "font-medium text-crit" : ""}>Due {fmtDate(r.enrollment.dueDate)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div>
                      <Progress value={r.percent} label={`${r.course.title} progress`} />
                      <p className="mt-1 type-meta">{r.remainingMinutes != null ? `${fmtMinutes(r.remainingMinutes)} remaining` : `${r.completedLessons}/${r.totalLessons} lessons`}</p>
                    </div>
                    <LinkButton href={`/learn/${r.course.slug}`} variant="secondary" size="sm">Continue</LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Career Development Health */}
          <Panel id="health" title="Career Development Health" description="Five evidence-based dimensions of your development. Each shows its status, evidence, gaps and next step." actions={<LinkButton href="/career" variant="ghost" size="sm">Full analysis</LinkButton>}>
            <HealthTable dimensions={o.health} computedAt={o.computedAt} />
          </Panel>

          {/* Timeline */}
          <Panel id="timeline" title="Learning activity" description="Recent milestones in your development record." actions={<LinkButton href="/history" variant="ghost" size="sm">Learning history</LinkButton>}>
            {timeline.length === 0 ? (
              <p className="type-meta">No activity recorded yet.</p>
            ) : (
              <ol className="relative ml-1.5 border-l border-line">
                {timeline.map((t) => (
                  <li key={t.id} className="relative pb-4 pl-5 last:pb-0">
                    <span aria-hidden className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full border border-surface bg-slate" />
                    <p className="font-sans text-[0.75rem] text-ink-faint">
                      <time dateTime={t.occurredAt.toISOString()}>{fmtDate(t.occurredAt)}</time> · {ACTIVITY_LABEL[t.type] ?? t.type}
                    </p>
                    <p className="text-[0.9rem] text-ink">{t.summary}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-8">
          <Panel id="priorities" title="Development priorities" description="Ordered by urgency, from your requirements and gaps.">
            {priorities.length === 0 ? (
              <p className="type-meta">No outstanding priorities. Review your development plan to set new goals.</p>
            ) : (
              <ol className="space-y-3.5">
                {priorities.map((pr, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] font-sans text-[0.6875rem] font-semibold tabular-nums ${pr.tone === "crit" ? "bg-crit-50 text-crit" : pr.tone === "warn" ? "bg-warn-50 text-warn" : "bg-navy-50 text-navy"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <Link href={pr.href} className="font-sans text-[0.8125rem] font-medium leading-snug text-ink no-underline hover:text-navy hover:underline">{pr.title}</Link>
                      <p className="type-meta">{pr.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel id="upcoming" title="Upcoming activities">
            <div className="space-y-5">
              <div>
                <h3 className="type-eyebrow mb-2">Webinars</h3>
                {o.registrations.length === 0 ? (
                  <p className="type-meta">No upcoming registrations. <Link href="/webinars">Browse webinars</Link></p>
                ) : (
                  <ul className="space-y-2.5">
                    {o.registrations.map((r) => (
                      <li key={r.id}>
                        <Link href={`/webinars/${r.webinar.slug}`} className="font-sans text-[0.8125rem] font-medium text-ink no-underline hover:underline">{r.webinar.title}</Link>
                        <p className="type-meta">{fmtDateTime(r.webinar.startsAt, r.webinar.timeZone)}{r.status === "WAITLISTED" && " · Waitlisted"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="type-eyebrow mb-2">Deadlines</h3>
                {upcomingDeadlines.length === 0 ? (
                  <p className="type-meta">No assigned deadlines.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {upcomingDeadlines.map((a) => {
                      const st = mandatoryState(a, o.computedAt);
                      const [label, tone] = MANDATORY[st];
                      return (
                        <li key={a.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={a.course ? `/courses/${a.course.slug}` : `/learning-paths/${a.path?.slug}`} className="font-sans text-[0.8125rem] font-medium text-ink no-underline hover:underline">
                              {a.course?.title ?? a.path?.title}
                            </Link>
                            <p className="type-meta">{a.isMandatory ? "Mandatory · " : ""}Due {fmtDate(a.dueDate)}</p>
                          </div>
                          <Status tone={tone}>{label}</Status>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {o.paths.length > 0 && (
                <div>
                  <h3 className="type-eyebrow mb-2">Learning paths</h3>
                  <ul className="space-y-3">
                    {o.paths.map((lp) => (
                      <li key={lp.enrolment.id}>
                        <Link href={`/learning-paths/${lp.path.slug}`} className="font-sans text-[0.8125rem] font-medium text-ink no-underline hover:underline">{lp.path.title}</Link>
                        <Progress value={lp.percent} label={`${lp.path.title} progress`} size="sm" />
                        {lp.next && <p className="type-meta">Next: {lp.next.title}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
