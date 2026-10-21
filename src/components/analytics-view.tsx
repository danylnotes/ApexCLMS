import type { computeAnalytics } from "@/server/services/analytics";
import { prisma } from "@/server/db";
import { BarList } from "./charts";
import { ColumnChart, TrendChart } from "./charts-client";
import { Metric, MetricRow, Panel, Status, Table, Td, Th } from "./ui";
import { fmtDate } from "@/lib/format";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { getI18n } from "@/i18n/server";
import { tr } from "@/i18n/active";

type Analytics = Awaited<ReturnType<typeof computeAnalytics>>;

export async function AnalyticsFiltersForm({ action, sp, showEmployment = true }: { action: string; sp: Record<string, string | undefined>; showEmployment?: boolean }) {
  const { t } = await getI18n();
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
      <select id={`af-${name}`} name={name} defaultValue={sp[name] ?? ""} className="input-base h-9 !py-1"><option value="">{t("All")}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
  );
  const y = new Date().getFullYear();
  return (
    <form action={action} className="mb-8 flex flex-wrap items-end gap-3 rounded-[22px] bg-surface p-4 no-print">
      {sel("department", t("Department"), departments.map((d) => [d.id, d.name]))}
      {sel("unit", t("Business unit"), units.map((u) => [u.id, u.name]))}
      {sel("role", t("Job role"), roles.map((r) => [r.id, r.title]))}
      {sel("location", t("Location"), locations.map((l) => [l.location!, l.location!]))}
      {sel("category", t("Course category"), categories.map((c) => [c.id, c.name]))}
      {showEmployment && sel("employment", t("Employment"), [["PERMANENT", t("Permanent")], ["CONTRACT", t("Contract")], ["ON_LEAVE", t("On leave")], ["SECONDED", t("Seconded")]])}
      <div><label htmlFor="af-from" className="type-eyebrow block">{t("From")}</label><input id="af-from" name="from" type="date" defaultValue={sp.from ?? `${y}-01-01`} className="input-base h-9" /></div>
      <div><label htmlFor="af-to" className="type-eyebrow block">{t("To")}</label><input id="af-to" name="to" type="date" defaultValue={sp.to ?? new Date().toISOString().slice(0, 10)} className="input-base h-9" /></div>
      <button type="submit" className="h-9 rounded bg-navy px-4 font-sans text-sm font-medium text-white">{t("Apply")}</button>
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
  const change = earlier ? Math.round((Math.abs(recent - earlier) / earlier) * 100) : 100;

  return (
    <div className="space-y-8">
      <p className="type-meta">{tr("Population: {count} active employees · Reporting window {from} – {to}. Point-in-time measures (compliance, coverage, overdue) reflect today.", { count: a.population, from: fmtDate(a.window.from), to: fmtDate(a.window.to) })}</p>
      <MetricRow cols={5}>
        {a.metrics.map((x) => <Metric key={x.key} label={x.label} value={x.display} definition={x.definition} tone={x.key === "overdue" && (x.value ?? 0) > 0 ? "crit" : undefined} />)}
      </MetricRow>

      <Panel title={tr("Management questions")} description={tr("Answered directly from current records. Associations shown here do not establish that training caused operational outcomes.")}>
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {[
            [tr("Which department has the most overdue mandatory training?"), worstDept && worstDept.overdue > 0 ? tr("{department}: {count, plural, one {# overdue item} other {# overdue items}} (compliance {compliance}%).", { department: worstDept.name, count: worstDept.overdue, compliance: worstDept.compliance ?? "—" }) : tr("No overdue mandatory training.")],
            [tr("Which role has the largest competency gap?"), worstRole ? tr("{role}: {coverage}% of requirements met across {count, plural, one {# requirement record} other {# requirement records}}.", { role: worstRole.role, coverage: worstRole.coverage, count: worstRole.requirements }) : tr("No role requirements configured.")],
            [tr("Which programme has the lowest completion rate?"), lowCourse ? tr("{code} {title}: {rate}% of {count, plural, one {# enrolment} other {# enrolments}} completed.", { code: lowCourse.code, title: lowCourse.title, rate: lowCourse.completionRate, count: lowCourse.enrolled }) : tr("Insufficient data (needs 3+ enrolments).")],
            [tr("Which competency lacks assessment evidence?"), weakEvidence ? tr("{competency}: {percent}% of requirements have no current assessment.", { competency: weakEvidence.name, percent: weakEvidence.notAssessedPercent }) : tr("Insufficient data.")],
            [tr("Which course has the strongest first-attempt outcomes?"), bestCourse ? tr("{code}: {rate}% first-attempt pass rate (n={n}).", { code: bestCourse.code, rate: bestCourse.firstPassRate, n: bestCourse.firstAttempts }) : tr("Insufficient data (needs 2+ first attempts).")],
            [tr("Is training activity increasing?"), recent + earlier === 0 ? tr("No completions in the last 12 months.") : recent >= earlier ? tr("{recent} completions in the last 6 months vs {earlier} in the previous 6 (up {change}%).", { recent, earlier, change }) : tr("{recent} completions in the last 6 months vs {earlier} in the previous 6 (down {change}%).", { recent, earlier, change })],
          ].map(([q, ans]) => (
            <div key={q}><dt className="font-sans text-[0.8125rem] font-semibold text-ink">{q}</dt><dd className="mt-0.5 text-[0.9rem] text-ink-muted">{ans}</dd></div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title={tr("Learning completion trend")} description={tr("Course completions per month, last 12 months.")}><TrendChart data={a.trend} xKey="month" yKey="completions" label={tr("Completions")} /></Panel>
        <Panel title={tr("Skills gap distribution")} description={tr("All role competency requirements in scope, by size of gap.")}><ColumnChart data={a.gapDistribution} xKey="bucket" yKey="count" label={tr("Requirements")} color="rgb(186 222 58)" /></Panel>
      </div>

      <Panel title={tr("By department")} description={drillHref ? tr("Select a department to drill down within your authorised scope.") : undefined} bodyClassName="pt-0">
        <Table caption={tr("Department breakdown")}>
          <thead><tr><Th>{tr("Department")}</Th><Th align="right">{tr("Employees")}</Th><Th align="right">{tr("Learning hours")}</Th><Th align="right">{tr("Mandatory compliance")}</Th><Th align="right">{tr("Overdue")}</Th><Th align="right">{tr("CPD participation")}</Th><Th align="right">{tr("Competency coverage")}</Th></tr></thead>
          <tbody>
            {a.departments.map((d) => (
              <tr key={d.name}>
                <Td className="font-medium">{drillHref && !d.suppressed ? <a href={drillHref(d.name)}>{d.name}</a> : d.name}{d.suppressed && <span className="ms-1 type-meta">{tr("(suppressed — fewer than 3 employees)")}</span>}</Td>
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
        <Panel title={tr("Competency coverage by role")}><BarList data={a.roleCoverage.map((r) => ({ label: r.role, value: r.coverage, note: tr("{count} req.", { count: r.requirements }) }))} max={100} suffix="%" /></Panel>
        <Panel title={tr("Training hours by department")} description={tr("Recorded platform learning time in the window.")}><BarList data={a.departments.filter((d) => !d.suppressed).map((d) => ({ label: d.name, value: d.hours }))} unit={tr("h")} tone="slate" /></Panel>
        <Panel title={tr("Mandatory training compliance by department")}><BarList data={a.departments.filter((d) => d.compliance != null).map((d) => ({ label: d.name, value: d.compliance }))} max={100} suffix="%" tone="copper" /></Panel>
        <Panel title={tr("CPD participation by department")} description={tr("Share of employees with an approved CPD claim in the window.")}><BarList data={a.departments.filter((d) => d.cpdParticipation != null).map((d) => ({ label: d.name, value: d.cpdParticipation }))} max={100} suffix="%" /></Panel>
      </div>

      <Panel title={tr("Course effectiveness")} description={tr("Completion rate and first-attempt assessment outcomes. These describe learning outcomes only.")} bodyClassName="pt-0">
        <Table caption={tr("Course effectiveness")}>
          <thead><tr><Th>{tr("Course")}</Th><Th align="right">{tr("Enrolments")}</Th><Th align="right">{tr("Completion rate")}</Th><Th align="right">{tr("First attempts")}</Th><Th align="right">{tr("First-attempt pass")}</Th><Th align="right">{tr("Avg first score")}</Th></tr></thead>
          <tbody>{a.courses.slice(0, 15).map((c) => <tr key={c.code}><Td><span className="font-medium">{c.code}</span> <span className="text-ink-muted">{c.title}</span></Td><Td align="right">{c.enrolled}</Td><Td align="right">{c.completionRate == null ? "—" : `${c.completionRate}%`}</Td><Td align="right">{c.firstAttempts}</Td><Td align="right">{c.firstPassRate == null ? "—" : `${c.firstPassRate}%`}</Td><Td align="right">{c.avgFirstScore == null ? "—" : `${c.avgFirstScore}%`}</Td></tr>)}</tbody>
        </Table>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title={tr("Development plan status")} description={tr("Latest plan per employee.")}>
          <BarList data={Object.entries(a.planDistribution).map(([k, v]) => ({ label: k === "NONE" ? tr("No plan") : PLAN_STATUS_LABEL[k as keyof typeof PLAN_STATUS_LABEL], value: v }))} tone="slate" />
        </Panel>
        <Panel title={tr("Certificate expiries — next 60 days")}>
          {a.expiries.length === 0 ? <p className="type-meta">{tr("None.")}</p> : showExpiryNames ? (
            <ul className="space-y-1.5 text-[0.875rem]">{a.expiries.map((e, i) => <li key={i} className="flex justify-between gap-3"><span>{e.user.name} — {e.course.title}</span><span className="type-meta">{fmtDate(e.expiresAt)}</span></li>)}</ul>
          ) : <p className="text-[0.875rem]">{tr("{count, plural, one {# certificate expires} other {# certificates expire}} within 60 days.", { count: a.expiries.length })}</p>}
        </Panel>
      </div>
    </div>
  );
}
