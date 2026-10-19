import type { computeAnalytics } from "@/server/services/analytics";
import { prisma } from "@/server/db";
import { BarList } from "./charts";
import { ColumnChart, TrendChart } from "./charts-client";
import { Metric, MetricRow, Panel, Status, Table, Td, Th } from "./ui";
import { fmtDate } from "@/lib/format";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";

type Analytics = Awaited<ReturnType<typeof computeAnalytics>>;

export async function AnalyticsFiltersForm({ action, sp, showEmployment = true }: { action: string; sp: Record<string, string | undefined>; showEmployment?: boolean }) {
  const [departments, units, roles, categories, locations] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ orderBy: { title: "asc" } }),
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.userProfile.findMany({ where: { location: { not: null } }, distinct: ["location"], select: { location: true } }),
  ]);
  const sel = (name: string, label: string, opts: [string, string][]) => (
    <div className="min-w-[140px] flex-1">
      <label htmlFor={`af-${name}`} className="type-eyebrow block">{label}</label>
      <select id={`af-${name}`} name={name} defaultValue={sp[name] ?? ""} className="input-base h-9 !py-1"><option value="">All</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
  );
  const y = new Date().getFullYear();
  return (
    <form action={action} className="mb-8 flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 no-print">
      {sel("department", "Department", departments.map((d) => [d.id, d.name]))}
      {sel("unit", "Business unit", units.map((u) => [u.id, u.name]))}
      {sel("role", "Job role", roles.map((r) => [r.id, r.title]))}
      {sel("location", "Location", locations.map((l) => [l.location!, l.location!]))}
      {sel("category", "Course category", categories.map((c) => [c.id, c.name]))}
      {showEmployment && sel("employment", "Employment", [["PERMANENT", "Permanent"], ["CONTRACT", "Contract"], ["ON_LEAVE", "On leave"], ["SECONDED", "Seconded"]])}
      <div><label htmlFor="af-from" className="type-eyebrow block">From</label><input id="af-from" name="from" type="date" defaultValue={sp.from ?? `${y}-01-01`} className="input-base h-9" /></div>
      <div><label htmlFor="af-to" className="type-eyebrow block">To</label><input id="af-to" name="to" type="date" defaultValue={sp.to ?? new Date().toISOString().slice(0, 10)} className="input-base h-9" /></div>
      <button type="submit" className="h-9 rounded bg-navy px-4 font-sans text-sm font-medium text-white">Apply</button>
    </form>
  );
}

/** Shared analytical view: every metric has a definition; charts show real persisted data. */
export function AnalyticsView({ a, drillHref, showExpiryNames = true }: { a: Analytics; drillHref?: (dept: string) => string; showExpiryNames?: boolean }) {
  const worstDept = [...a.departments].filter((d) => !d.suppressed).sort((x, y) => y.overdue - x.overdue)[0];
  const worstRole = a.roleCoverage[0];
  const lowCourse = [...a.courses].filter((c) => c.enrolled >= 3 && c.completionRate != null).sort((x, y) => (x.completionRate ?? 0) - (y.completionRate ?? 0))[0];
  const weakEvidence = [...a.weakestCompetencies].sort((x, y) => y.notAssessedPercent - x.notAssessedPercent)[0];
  const bestCourse = [...a.courses].filter((c) => c.firstAttempts >= 2 && c.firstPassRate != null).sort((x, y) => (y.firstPassRate ?? 0) - (x.firstPassRate ?? 0))[0];
  const half = Math.floor(a.trend.length / 2);
  const recent = a.trend.slice(half).reduce((s, t) => s + t.completions, 0);
  const earlier = a.trend.slice(0, half).reduce((s, t) => s + t.completions, 0);

  return (
    <div className="space-y-8">
      <p className="type-meta">Population: {a.population} active employees · Reporting window {fmtDate(a.window.from)} – {fmtDate(a.window.to)}. Point-in-time measures (compliance, coverage, overdue) reflect today.</p>
      <MetricRow cols={5}>
        {a.metrics.map((x) => <Metric key={x.key} label={x.label} value={x.display} definition={x.definition} tone={x.key === "overdue" && (x.value ?? 0) > 0 ? "crit" : undefined} />)}
      </MetricRow>

      <Panel title="Management questions" description="Answered directly from current records. Associations shown here do not establish that training caused operational outcomes.">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {[
            ["Which department has the most overdue mandatory training?", worstDept && worstDept.overdue > 0 ? `${worstDept.name}: ${worstDept.overdue} overdue item${worstDept.overdue === 1 ? "" : "s"} (compliance ${worstDept.compliance ?? "—"}%).` : "No overdue mandatory training."],
            ["Which role has the largest competency gap?", worstRole ? `${worstRole.role}: ${worstRole.coverage}% of requirements met across ${worstRole.requirements} requirement records.` : "No role requirements configured."],
            ["Which programme has the lowest completion rate?", lowCourse ? `${lowCourse.code} ${lowCourse.title}: ${lowCourse.completionRate}% of ${lowCourse.enrolled} enrolments completed.` : "Insufficient data (needs 3+ enrolments)."],
            ["Which competency lacks assessment evidence?", weakEvidence ? `${weakEvidence.name}: ${weakEvidence.notAssessedPercent}% of requirements have no current assessment.` : "Insufficient data."],
            ["Which course has the strongest first-attempt outcomes?", bestCourse ? `${bestCourse.code}: ${bestCourse.firstPassRate}% first-attempt pass rate (n=${bestCourse.firstAttempts}).` : "Insufficient data (needs 2+ first attempts)."],
            ["Is training activity increasing?", recent + earlier === 0 ? "No completions in the last 12 months." : `${recent} completions in the last 6 months vs ${earlier} in the previous 6 (${recent >= earlier ? "up" : "down"} ${earlier ? Math.round((Math.abs(recent - earlier) / earlier) * 100) : 100}%).`],
          ].map(([q, ans]) => (
            <div key={q}><dt className="font-sans text-[0.8125rem] font-semibold text-ink">{q}</dt><dd className="mt-0.5 text-[0.9rem] text-ink-muted">{ans}</dd></div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Learning completion trend" description="Course completions per month, last 12 months."><TrendChart data={a.trend} xKey="month" yKey="completions" label="Completions" /></Panel>
        <Panel title="Skills gap distribution" description="All role competency requirements in scope, by size of gap."><ColumnChart data={a.gapDistribution} xKey="bucket" yKey="count" label="Requirements" color="rgb(166 98 52)" /></Panel>
      </div>

      <Panel title="By department" description={drillHref ? "Select a department to drill down within your authorised scope." : undefined} bodyClassName="pt-0">
        <Table caption="Department breakdown">
          <thead><tr><Th>Department</Th><Th align="right">Employees</Th><Th align="right">Learning hours</Th><Th align="right">Mandatory compliance</Th><Th align="right">Overdue</Th><Th align="right">CPD participation</Th><Th align="right">Competency coverage</Th></tr></thead>
          <tbody>
            {a.departments.map((d) => (
              <tr key={d.name}>
                <Td className="font-medium">{drillHref && !d.suppressed ? <a href={drillHref(d.name)}>{d.name}</a> : d.name}{d.suppressed && <span className="ml-1 type-meta">(suppressed — fewer than 3 employees)</span>}</Td>
                <Td align="right">{d.employees}</Td>
                <Td align="right">{d.suppressed ? "—" : d.hours}</Td>
                <Td align="right">{d.compliance == null ? "—" : `${d.compliance}%`}</Td>
                <Td align="right">{d.suppressed ? "—" : d.overdue > 0 ? <Status tone="crit">{d.overdue}</Status> : 0}</Td>
                <Td align="right">{d.cpdParticipation == null ? "—" : `${d.cpdParticipation}%`}</Td>
                <Td align="right">{d.coverage == null ? "—" : `${d.coverage}%`}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Competency coverage by role"><BarList data={a.roleCoverage.map((r) => ({ label: r.role, value: r.coverage, note: `${r.requirements} req.` }))} max={100} suffix="%" /></Panel>
        <Panel title="Training hours by department" description="Recorded platform learning time in the window."><BarList data={a.departments.filter((d) => !d.suppressed).map((d) => ({ label: d.name, value: d.hours }))} unit="h" tone="slate" /></Panel>
        <Panel title="Mandatory training compliance by department"><BarList data={a.departments.filter((d) => d.compliance != null).map((d) => ({ label: d.name, value: d.compliance }))} max={100} suffix="%" tone="copper" /></Panel>
        <Panel title="CPD participation by department" description="Share of employees with an approved CPD claim in the window."><BarList data={a.departments.filter((d) => d.cpdParticipation != null).map((d) => ({ label: d.name, value: d.cpdParticipation }))} max={100} suffix="%" /></Panel>
      </div>

      <Panel title="Course effectiveness" description="Completion rate and first-attempt assessment outcomes. These describe learning outcomes only." bodyClassName="pt-0">
        <Table caption="Course effectiveness">
          <thead><tr><Th>Course</Th><Th align="right">Enrolments</Th><Th align="right">Completion rate</Th><Th align="right">First attempts</Th><Th align="right">First-attempt pass</Th><Th align="right">Avg first score</Th></tr></thead>
          <tbody>{a.courses.slice(0, 15).map((c) => <tr key={c.code}><Td><span className="font-medium">{c.code}</span> <span className="text-ink-muted">{c.title}</span></Td><Td align="right">{c.enrolled}</Td><Td align="right">{c.completionRate == null ? "—" : `${c.completionRate}%`}</Td><Td align="right">{c.firstAttempts}</Td><Td align="right">{c.firstPassRate == null ? "—" : `${c.firstPassRate}%`}</Td><Td align="right">{c.avgFirstScore == null ? "—" : `${c.avgFirstScore}%`}</Td></tr>)}</tbody>
        </Table>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Development plan status" description="Latest plan per employee.">
          <BarList data={Object.entries(a.planDistribution).map(([k, v]) => ({ label: k === "NONE" ? "No plan" : PLAN_STATUS_LABEL[k as keyof typeof PLAN_STATUS_LABEL], value: v }))} tone="slate" />
        </Panel>
        <Panel title="Certificate expiries — next 60 days">
          {a.expiries.length === 0 ? <p className="type-meta">None.</p> : showExpiryNames ? (
            <ul className="space-y-1.5 text-[0.875rem]">{a.expiries.map((e, i) => <li key={i} className="flex justify-between gap-3"><span>{e.user.name} — {e.course.title}</span><span className="type-meta">{fmtDate(e.expiresAt)}</span></li>)}</ul>
          ) : <p className="text-[0.875rem]">{a.expiries.length} certificates expire within 60 days.</p>}
        </Panel>
      </div>
    </div>
  );
}
