import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { employeeOverview, developmentPriorities } from "@/server/services/overview";
import { prisma } from "@/server/db";
import { HealthTable } from "@/components/health";
import { ArrowUpRight, Award, BookCheck, BookOpen, CalendarClock, ChevronRight, Gauge, Presentation, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { searchCatalogue } from "@/server/services/catalogue";
import { accessSummary } from "@/server/services/access";
import { EmptyState, LinkButton, Panel, Progress, Status } from "@/components/ui";
import { BarChart, chipClass, MiniCalendar, ProgressRing, StatCard } from "@/components/widgets";
import { fmtDate, fmtDateTime, fmtHours, fmtMinutes, fmtNum, fmtRelative } from "@/lib/format";
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

const WEEKS = 8;

export default async function DashboardPage() {
  const actor = await requireActor();
  const o = await employeeOverview(actor.id);
  const priorities = developmentPriorities(o);
  const weekMs = 7 * 86_400_000;
  const since = new Date(o.computedAt.getTime() - WEEKS * weekMs);
  const [timeline, study, discover, access] = await Promise.all([
    prisma.learningActivityEvent.findMany({
      where: { userId: actor.id, type: { notIn: ["LESSON_COMPLETED", "ENROLLED"] } },
      orderBy: { occurredAt: "desc" },
      take: 8,
    }),
    prisma.lessonProgress.findMany({
      where: { enrollment: { userId: actor.id }, OR: [{ lastViewedAt: { gte: since } }, { completedAt: { gte: since } }] },
      select: { lastViewedAt: true, completedAt: true, timeSpentSeconds: true },
    }),
    searchCatalogue(actor.id, { sort: "recent", pageSize: 12 }),
    accessSummary(actor.id),
  ]);
  const p = o.profile;
  const year = o.computedAt.getUTCFullYear();
  const unitLabel = o.metrics.cpdUnit === "POINTS" ? "points" : "hours";
  const upcomingDeadlines = o.assignments.filter((a) => a.status === "ASSIGNED" && a.dueDate).slice(0, 5);
  const firstName = actor.name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "").split(" ")[0];
  const newForYou = discover.items.filter((c) => !c.enrolmentStatus).slice(0, 3);

  // Study hours per week (lesson time recorded by the player), oldest first.
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const end = new Date(o.computedAt.getTime() - (WEEKS - 1 - i) * weekMs);
    const start = new Date(end.getTime() - weekMs);
    return { start, end, value: 0 };
  });
  for (const s of study) {
    const at = s.lastViewedAt ?? s.completedAt;
    if (!at) continue;
    const w = weeks.find((x) => at > x.start && at <= x.end);
    if (w) w.value += s.timeSpentSeconds / 3600;
  }
  const bars = weeks.map((w, i) => ({ label: i === WEEKS - 1 ? "Now" : `${w.end.getUTCDate()}/${w.end.getUTCMonth() + 1}`, full: `Week ending ${fmtDate(w.end)}`, value: Math.round(w.value * 10) / 10 }));
  const peak = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), WEEKS - 1);
  const totalHours = bars.reduce((sum, b) => sum + b.value, 0);

  // Calendar events: assignment deadlines and webinar registrations.
  const calendar = [
    ...upcomingDeadlines.map((a) => ({ date: a.dueDate!, tone: (mandatoryState(a, o.computedAt) === "OVERDUE" ? "crit" : "warn") as "crit" | "warn" })),
    ...o.registrations.map((r) => ({ date: r.webinar.startsAt, tone: "info" as const })),
  ];
  const schedule = [
    ...o.registrations.map((r) => ({ key: r.id, kind: "Webinar", title: r.webinar.title, when: fmtDateTime(r.webinar.startsAt, r.webinar.timeZone), href: `/webinars/${r.webinar.slug}`, at: r.webinar.startsAt, note: r.status === "WAITLISTED" ? "Waitlisted" : null })),
    ...upcomingDeadlines.map((a) => ({ key: a.id, kind: a.isMandatory ? "Mandatory deadline" : "Deadline", title: a.course?.title ?? a.path?.title ?? "", when: `Due ${fmtDate(a.dueDate)}`, href: a.course ? `/courses/${a.course.slug}` : `/learning-paths/${a.path?.slug}`, at: a.dueDate!, note: null })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 5);

  const targetSummary = o.target?.rows.length ? o.target.summary : null;
  const targetGranted = !!p?.targetJobRoleId && access.grants.some((g) => g.jobRoleId === p.targetJobRoleId);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <section aria-labelledby="welcome" className="relative overflow-hidden rounded-[28px] bg-navy px-5 py-6 text-white sm:px-8 sm:py-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-lime/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-lime">Your development overview · {o.cpd.period?.name ?? year} development period</p>
            <h1 id="welcome" className="mt-2 font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-white md:text-[2rem]">Welcome back, {firstName}</h1>
            <p className="mt-2 max-w-2xl text-[0.9375rem] text-white/70">Track your learning, strengthen your technical competencies, and prepare for your next career milestone.</p>
            <dl className="mt-4 flex flex-wrap gap-2 font-sans text-[0.75rem]">
              {[
                ["Staff ID", access.staffId],
                ["Role", p?.jobRole?.title],
                ["Department", p?.department?.name],
                ["Business unit", p?.businessUnit?.name],
                ["Programme", p?.learningProgramme],
                ["Target role", p?.targetJobRole?.title],
              ].map(([k, v], i) => (
                <div key={k} className={`gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ${i >= 2 && i <= 4 ? "hidden sm:flex" : "flex"}`}>
                  <dt className="text-white/55">{k}</dt>
                  <dd className="font-semibold text-white">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-3xl bg-white/[0.07] p-4">
            <ProgressRing value={o.metrics.overallPercent ?? 0} size={92} stroke={9} tone="light" label="Overall learning progress">
              {o.metrics.overallPercent == null ? "—" : `${o.metrics.overallPercent}%`}
            </ProgressRing>
            <div className="font-sans">
              <p className="text-[0.75rem] text-white/60">Overall progress</p>
              <p className="text-sm font-semibold">{o.courseRows.length} enrolment{o.courseRows.length === 1 ? "" : "s"}</p>
              <LinkButton href="/my-learning" variant="accent" size="sm" className="mt-2">My learning</LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Personal learning summary */}
      <section aria-labelledby="summary">
        <h2 id="summary" className="sr-only">Personal learning summary</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
          <StatCard chip={0} icon={<Gauge className="h-5 w-5" />} label="Overall learning progress" value={o.metrics.overallPercent == null ? "—" : `${o.metrics.overallPercent}%`} context={`across ${o.courseRows.length} enrolment${o.courseRows.length === 1 ? "" : "s"}`} definition="Average completion of required lessons across all your active and completed enrolments." />
          <StatCard chip={2} icon={<BookCheck className="h-5 w-5" />} label="Courses completed" value={o.metrics.coursesCompleted} context={`total · ${o.metrics.coursesCompletedThisYear} in ${year}`} definition="Courses whose completion rules you have satisfied. Cumulative total, with the current calendar year shown separately." />
          <StatCard chip={3} icon={<BookOpen className="h-5 w-5" />} label="Courses in progress" value={o.metrics.coursesInProgress} context="active now" definition="Enrolments that are active and not yet completed." />
          <StatCard chip={1} icon={<Award className="h-5 w-5" />} label={`CPD ${unitLabel} approved`} value={o.metrics.cpdApproved == null ? "—" : fmtNum(o.metrics.cpdApproved)} context={o.metrics.cpdTarget != null ? `of ${o.metrics.cpdTarget} target · ${o.cpd.period?.name}` : o.cpd.policy ? "no target set" : "no CPD policy"} definition="Approved CPD claims in the current reporting period only. Pending and rejected claims are excluded." />
          <StatCard chip={0} icon={<Presentation className="h-5 w-5" />} label="Webinars attended" value={o.metrics.webinarsAttended} context={`total · ${o.metrics.webinarsAttendedThisYear} in ${year}`} definition="Webinars with a recorded attendance. Registration alone does not count." />
          <StatCard chip={1} icon={<ShieldCheck className="h-5 w-5" />} label="Mandatory compliance" value={o.metrics.compliancePercent == null ? "—" : `${o.metrics.compliancePercent}%`} context={o.compliance.overdue ? `${o.compliance.overdue} overdue` : o.compliance.total ? `${o.compliance.completed}/${o.compliance.total} complete` : "none assigned"} tone={o.compliance.overdue ? "crit" : o.compliance.dueSoon ? "warn" : undefined} definition={COMPLIANCE_METHOD} />
          <StatCard chip={2} icon={<Target className="h-5 w-5" />} label="Competency coverage" value={o.metrics.competencyCoverage == null ? "—" : `${o.metrics.competencyCoverage}%`} context={o.competency.rows.length ? `${o.competency.summary.met}/${o.competency.summary.required} role requirements` : "no role requirements"} definition="Competency requirements of your current role met at the required level by a current, demonstrated assessment. Knowledge-only evidence (e.g. course completion) does not count under the current framework." />
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* New for your job title */}
          <section aria-labelledby="new-h">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="new-h" className="type-section">New for your job title</h2>
                <p className="type-meta">Recently published courses within your access{access.allContent ? " (all content)" : access.grants.length ? ` (${access.grants.map((g) => g.jobRole.title).join(", ")})` : " (open courses only)"}.</p>
              </div>
              <LinkButton href="/catalogue" variant="ghost" size="sm">View all</LinkButton>
            </div>
            {newForYou.length === 0 ? (
              <EmptyState title="You are enrolled on everything new">Browse the catalogue for more courses open to your job title.</EmptyState>
            ) : (
              <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
                {newForYou.map((c, i) => (
                  <li key={c.id} className={`group relative flex w-[80%] shrink-0 snap-start flex-col rounded-[22px] p-5 sm:w-[46%] md:w-auto ${chipClass(i)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-navy" aria-hidden><BookOpen className="h-5 w-5" /></span>
                      <span className="rounded-full bg-surface/70 px-2.5 py-1 font-sans text-[0.75rem] font-semibold text-ink">{c.code}</span>
                    </div>
                    <p className="mt-4 font-sans text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">{c.category.name}</p>
                    <Link href={`/courses/${c.slug}`} className="mt-1 font-sans text-[1rem] font-bold leading-snug text-ink no-underline after:absolute after:inset-0 hover:underline">{c.title}</Link>
                    <div className="mt-auto flex items-center justify-between pt-4 font-sans text-[0.75rem] text-ink-muted">
                      <span>{fmtHours(c.estimatedHours.toString())}{c.cpdEligible ? " · CPD" : ""}{c.isMandatory ? " · Mandatory" : ""}</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-lime transition-transform group-hover:rotate-45" aria-hidden><ArrowUpRight className="h-4 w-4" /></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] [&>*]:min-w-0">
            {/* Study hours */}
            <Panel id="hours" title="Study hours" description={`${totalHours.toFixed(1)} h of lesson time in the last ${WEEKS} weeks`} actions={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink" aria-hidden><TrendingUp className="h-4 w-4" /></span>}>
              <BarChart data={bars} highlight={peak} unit="h" />
            </Panel>

            {/* Schedule */}
            <Panel id="upcoming" title="Upcoming schedule" actions={<LinkButton href="/webinars" variant="ghost" size="sm">Webinars</LinkButton>} bodyClassName="px-3 pb-3 pt-2">
              {schedule.length === 0 ? (
                <p className="px-3 type-meta">No upcoming registrations or deadlines. <Link href="/webinars">Browse webinars</Link></p>
              ) : (
                <ul className="space-y-1">
                  {schedule.map((e, i) => (
                    <li key={e.key}>
                      <Link href={e.href} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 no-underline hover:bg-canvas">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-navy ${chipClass(i + 1)}`} aria-hidden>{e.kind === "Webinar" ? <Presentation className="h-[18px] w-[18px]" /> : <CalendarClock className="h-[18px] w-[18px]" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-sans text-[0.8125rem] font-semibold text-ink">{e.title}</span>
                          <span className="block truncate font-sans text-[0.75rem] text-ink-faint">{e.kind} · {e.when}{e.note ? ` · ${e.note}` : ""}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Continue learning */}
          <Panel id="continue" title="Courses you're taking" description="Active courses, prioritising those approaching their due date." actions={<LinkButton href="/my-learning" variant="ghost" size="sm">All learning</LinkButton>} bodyClassName="px-3 pb-3 pt-2">
            {o.continueLearning.length === 0 ? (
              <div className="p-3">
                <EmptyState title="No courses in progress" action={<LinkButton href="/catalogue" variant="secondary" size="sm">Browse the catalogue</LinkButton>}>
                  Enrol in a course or start an assigned course to see it here.
                </EmptyState>
              </div>
            ) : (
              <ul className="space-y-1">
                {o.continueLearning.slice(0, 4).map((r, i) => (
                  <li key={r.enrollment.id} className="grid items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-3 hover:bg-canvas sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                    <span className={`hidden h-11 w-11 items-center justify-center rounded-2xl text-navy sm:flex ${chipClass(i)}`} aria-hidden><BookOpen className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <Link href={`/courses/${r.course.slug}`} className="block truncate font-sans text-[0.9375rem] font-semibold text-ink no-underline hover:underline">
                        {r.course.title}
                      </Link>
                      <p className="mt-0.5 truncate type-meta">
                        {r.course.code} · {r.course.instructors[0]?.user.name ?? r.course.provider} · Last accessed {fmtRelative(r.enrollment.lastAccessedAt)}
                        {r.enrollment.dueDate && (
                          <>
                            {" · "}
                            <span className={r.enrollment.dueDate < o.computedAt ? "font-semibold text-crit" : ""}>Due {fmtDate(r.enrollment.dueDate)}</span>
                          </>
                        )}
                      </p>
                      <p className="type-meta">{r.remainingMinutes != null ? `${fmtMinutes(r.remainingMinutes)} remaining` : `${r.completedLessons}/${r.totalLessons} lessons`}</p>
                    </div>
                    <ProgressRing value={r.percent} label={`${r.course.title} progress`} />
                    <LinkButton href={`/learn/${r.course.slug}`} variant="primary" size="sm">Continue</LinkButton>
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
              <ol className="relative ml-1.5 border-l-2 border-canvas">
                {timeline.map((t) => (
                  <li key={t.id} className="relative pb-4 pl-5 last:pb-0">
                    <span aria-hidden className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-lime-600" />
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

        <aside className="min-w-0 space-y-6">
          {/* Next level */}
          <section aria-labelledby="next-h" className="relative overflow-hidden rounded-[28px] bg-navy p-6 text-white">
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-lime/25 blur-2xl" />
            <p className="relative font-sans text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-lime">Next career level</p>
            <h2 id="next-h" className="relative mt-2 font-sans text-xl font-extrabold leading-snug text-white">{p?.targetJobRole?.title ?? "Set a target role"}</h2>
            <p className="relative mt-1.5 text-[0.8125rem] text-white/70">
              {targetSummary
                ? `${targetSummary.met} of ${targetSummary.required} competency requirements met for the target role.`
                : p?.targetJobRole
                  ? "No competency requirements are defined for the target role yet."
                  : "Agree a target role in your development plan to see your readiness."}
            </p>
            {targetSummary && <div className="relative mt-4"><Progress value={targetSummary.coveragePercent ?? 0} label="Target role readiness" tone="copper" /></div>}
            <p className="relative mt-4 rounded-2xl bg-white/10 px-3 py-2 font-sans text-[0.75rem] text-white/80">
              {p?.targetJobRole ? (targetGranted ? "Content for this level is open to you." : "Content for this level opens when your administrator grants access.") : "Access to each level is decided by your administrator."}
            </p>
            <LinkButton href="/career" variant="accent" size="sm" className="relative mt-4">View career path</LinkButton>
          </section>

          <Panel id="calendar">
            <MiniCalendar today={o.computedAt} events={calendar} />
            <p className="mt-3 flex flex-wrap gap-3 font-sans text-[0.75rem] text-ink-faint">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden />Webinar</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />Deadline</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-crit" aria-hidden />Overdue</span>
            </p>
          </Panel>

          <Panel id="priorities" title="Development priorities" description="Ordered by urgency, from your requirements and gaps.">
            {priorities.length === 0 ? (
              <p className="type-meta">No outstanding priorities. Review your development plan to set new goals.</p>
            ) : (
              <ol className="space-y-3.5">
                {priorities.map((pr, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-sans text-[0.75rem] font-bold tabular-nums ${pr.tone === "crit" ? "bg-crit-50 text-crit" : pr.tone === "warn" ? "bg-warn-50 text-warn" : "bg-lime text-navy"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <Link href={pr.href} className="font-sans text-[0.8125rem] font-semibold leading-snug text-ink no-underline hover:underline">{pr.title}</Link>
                      <p className="type-meta">{pr.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel id="assignments" title="Assignments" actions={<LinkButton href="/my-learning?tab=mandatory" variant="ghost" size="sm">See all</LinkButton>}>
            {upcomingDeadlines.length === 0 ? (
              <p className="type-meta">No assigned deadlines.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingDeadlines.map((a) => {
                  const st = mandatoryState(a, o.computedAt);
                  const [label, tone] = MANDATORY[st];
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={a.course ? `/courses/${a.course.slug}` : `/learning-paths/${a.path?.slug}`} className="font-sans text-[0.8125rem] font-semibold text-ink no-underline hover:underline">
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
          </Panel>

          {o.paths.length > 0 && (
            <Panel id="paths" title="Learning paths">
              <ul className="space-y-4">
                {o.paths.map((lp) => (
                  <li key={lp.enrolment.id}>
                    <Link href={`/learning-paths/${lp.path.slug}`} className="font-sans text-[0.8125rem] font-semibold text-ink no-underline hover:underline">{lp.path.title}</Link>
                    <div className="mt-1"><Progress value={lp.percent} label={`${lp.path.title} progress`} size="sm" /></div>
                    {lp.next && <p className="type-meta">Next: {lp.next.title}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
