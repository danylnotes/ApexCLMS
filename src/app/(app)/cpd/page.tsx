import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { cpdWorkspace, CPD_TYPE_LABEL } from "@/server/services/cpd";
import { BarList } from "@/components/charts";
import { EmptyState, LinkButton, Metric, MetricRow, PageHeader, Panel, Progress, Status, Table, Td, Th } from "@/components/ui";
import { CPD_STATUS } from "@/lib/status";
import { fmtDate, fmtNum } from "@/lib/format";

export const metadata = { title: "My CPD" };

export default async function CpdPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireActor();
  const { period: periodId } = await searchParams;
  const [ws, periods] = await Promise.all([cpdWorkspace(actor.id, periodId), prisma.reportingPeriod.findMany({ orderBy: { startDate: "desc" } })]);
  const unit = ws.policy?.unit === "POINTS" ? "points" : "hours";
  const s = ws.summary;
  return (
    <div>
      <PageHeader
        eyebrow="Development"
        title="Continuing Professional Development"
        description="A verifiable record of your professional learning. Company-recorded learning and activity intended for external professional-body recognition are shown separately."
        actions={<><LinkButton href={`/api/v1/exports/cpd-statement?period=${ws.period?.id ?? ""}`} variant="secondary">Download statement (PDF)</LinkButton><LinkButton href={`/api/v1/exports/cpd?period=${ws.period?.id ?? ""}`} variant="secondary">Export CSV</LinkButton><LinkButton href="/cpd/new">Record CPD activity</LinkButton></>}
      />
      <form className="mb-6 flex items-end gap-2" action="/cpd">
        <div><label htmlFor="period" className="type-eyebrow block">Reporting period</label><select id="period" name="period" defaultValue={ws.period?.id} className="input-base h-9 !py-1">{periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isCurrent ? " (current)" : ""}</option>)}</select></div>
        <button type="submit" className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Show</button>
      </form>

      <MetricRow cols={5}>
        <Metric label="CPD target" value={s?.target != null ? fmtNum(s.target) : "None"} context={s?.target != null ? unit : ws.policy ? "record-only policy" : "no policy assigned"} definition={ws.policy ? `${ws.policy.name}${ws.policy.professionalBody ? ` — ${ws.policy.professionalBody}` : ""}. Targets are set per policy; no universal target applies.` : "No CPD policy is assigned to your profile. Ask L&D if your role requires one."} />
        <Metric label="Approved" value={fmtNum(s?.approved ?? 0)} context={unit} definition="Sum of approved values for claims in this period. Only approved claims count." />
        <Metric label="Pending review" value={fmtNum(s?.pending ?? 0)} context={`${unit} · ${s?.pendingCount ?? 0} claims`} definition="Submitted or under review. Shown at the claimed value, which may be adjusted on approval." />
        <Metric label="Remaining to target" value={s?.remaining != null ? fmtNum(s.remaining) : "—"} context={s?.remaining != null ? unit : ""} />
        <Metric label="Period" value={ws.period?.name ?? "—"} context={s ? `${s.periodElapsedPercent}% elapsed` : ""} definition={ws.period ? `${fmtDate(ws.period.startDate)} – ${fmtDate(ws.period.endDate)}` : undefined} />
      </MetricRow>
      {s?.target != null && <div className="mt-4 max-w-xl"><Progress value={s.percentOfTarget ?? 0} label="Approved CPD against target" tone={s.percentOfTarget! >= s.periodElapsedPercent ? "ok" : "warn"} /><p className="mt-1 type-meta">Pro-rata expectation at this point in the period: {fmtNum(s.proRataExpected)} {unit}.</p></div>}

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="CPD records" description="Draft → Submitted → Under review → Approved or Rejected" bodyClassName="pt-0">
          {ws.claims.length === 0 ? <div className="pt-4"><EmptyState title="No CPD recorded for this period" action={<LinkButton href="/cpd/new" size="sm">Record an activity</LinkButton>} /></div> : (
            <Table caption="CPD records">
              <thead><tr><Th>Activity</Th><Th>Type</Th><Th>Date</Th><Th align="right">Claimed</Th><Th align="right">Approved</Th><Th>Status</Th></tr></thead>
              <tbody>
                {ws.claims.map((c) => (
                  <tr key={c.id}>
                    <Td><Link href={`/cpd/${c.id}`} className="font-medium">{c.activity.title}</Link><div className="type-meta">{c.recognition === "PROFESSIONAL_BODY" ? "For professional-body recognition" : "Company-recorded"}{c.activity.courseCompletionId || c.activity.webinarAttendanceId ? " · platform-verified" : ""}</div></Td>
                    <Td>{CPD_TYPE_LABEL[c.activity.type]}</Td>
                    <Td>{fmtDate(c.activity.activityDate)}</Td>
                    <Td align="right">{fmtNum(c.claimedValue.toString())}</Td>
                    <Td align="right">{c.approvedValue != null ? fmtNum(c.approvedValue.toString()) : "—"}</Td>
                    <Td><Status tone={CPD_STATUS[c.status][1]}>{CPD_STATUS[c.status][0]}</Status></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <aside className="space-y-6">
          <Panel title="Approved CPD by category">
            {ws.byType.length ? <BarList data={ws.byType.map((b) => ({ label: b.label, value: b.value }))} unit={unit === "points" ? "pts" : "h"} /> : <p className="type-meta">No approved CPD in this period.</p>}
          </Panel>
          <Panel title="Recognition">
            <dl className="space-y-2 font-sans text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Company-recorded learning</dt><dd className="tabular-nums">{fmtNum(ws.byRecognition.COMPANY_RECORDED)} {unit}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Intended for professional body</dt><dd className="tabular-nums">{fmtNum(ws.byRecognition.PROFESSIONAL_BODY)} {unit}</dd></div>
            </dl>
            <p className="mt-3 text-[0.8125rem] text-ink-muted">Approval here confirms the activity for company records. Recognition by an external professional body is decided by that body under its own rules.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
