import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { reportingScope } from "@/server/policy";
import { employeeOverview } from "@/server/services/overview";
import { EmptyState, LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { HEALTH_STATUS_LABEL } from "@/lib/domain/health";
import { PLAN_TONE } from "@/lib/status";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";

export const metadata = { title: "Team Learning" };

const GLYPH = { ON_TRACK: "●", ATTENTION: "▲", ACTION: "■", INSUFFICIENT: "○" } as const;
const COLOR = { ON_TRACK: "text-ok", ATTENTION: "text-warn", ACTION: "text-crit", INSUFFICIENT: "text-idle" } as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ department?: string; q?: string }> }) {
  const actor = await requirePagePermission("team.view");
  const sp = await searchParams;
  const scope = await reportingScope(actor.id);
  // Each overview is computed from live records; suitable for typical team sizes.
  let team = await Promise.all(scope.map((id) => employeeOverview(id)));
  team = team.filter((o) => o.user.status === "ACTIVE");
  if (sp.department) team = team.filter((o) => o.profile?.department?.name === sp.department);
  if (sp.q) team = team.filter((o) => o.user.name.toLowerCase().includes(sp.q!.toLowerCase()));
  team.sort((a, b) => b.compliance.overdue - a.compliance.overdue || a.user.name.localeCompare(b.user.name));
  return (
    <div>
      <PageHeader eyebrow="Management" title="Team Learning" crumbs={[{ label: "Manager Dashboard", href: "/manager" }, { label: "Team learning" }]} description="Progress, compliance and development status for employees in your reporting line." actions={<LinkButton href="/api/v1/exports/team-learning" variant="secondary">Export (CSV)</LinkButton>} />
      <form className="mb-4 flex flex-wrap items-end gap-2" action="/manager/team">
        <div><label htmlFor="q" className="type-eyebrow block">Search</label><input id="q" name="q" defaultValue={sp.q} className="input-base h-9" /></div>
        {sp.department && <input type="hidden" name="department" value={sp.department} />}
        <button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Filter</button>
        {sp.department && <span className="type-meta">Department: {sp.department} · <Link href="/manager/team">clear</Link></span>}
      </form>
      {team.length === 0 ? <EmptyState title="No employees in scope" /> : (
        <Panel bodyClassName="pt-0">
          <Table caption="Team learning overview">
            <thead><tr><Th>Employee</Th><Th align="right">In progress</Th><Th align="right">Completed ({new Date().getFullYear()})</Th><Th>Mandatory</Th><Th align="right">Competency coverage</Th><Th>Plan</Th><Th>Development health</Th></tr></thead>
            <tbody>
              {team.map((o) => (
                <tr key={o.user.id}>
                  <Td><Link href={`/manager/team/${o.user.id}`} className="font-medium">{o.user.name}</Link><div className="type-meta">{o.profile?.jobRole?.title} · {o.profile?.department?.name}</div></Td>
                  <Td align="right">{o.metrics.coursesInProgress}</Td>
                  <Td align="right">{o.metrics.coursesCompletedThisYear}</Td>
                  <Td>{o.compliance.total === 0 ? <span className="type-meta">None</span> : o.compliance.overdue ? <Status tone="crit">{o.compliance.overdue} overdue</Status> : o.compliance.dueSoon ? <Status tone="warn">{o.compliance.dueSoon} due soon</Status> : <Status tone="ok">Compliant</Status>}</Td>
                  <Td align="right">{o.metrics.competencyCoverage == null ? "—" : `${o.metrics.competencyCoverage}%`}</Td>
                  <Td>{o.plan ? <Status tone={PLAN_TONE[o.plan.status]} glyph={false}>{PLAN_STATUS_LABEL[o.plan.status]}</Status> : <span className="type-meta">No plan</span>}</Td>
                  <Td>
                    <span className="inline-flex gap-1.5 font-sans text-[0.8125rem]">
                      {o.health.map((h) => <span key={h.key} title={`${h.title}: ${HEALTH_STATUS_LABEL[h.status]}`} className={COLOR[h.status]}>{GLYPH[h.status]}<span className="sr-only">{h.title}: {HEALTH_STATUS_LABEL[h.status]}. </span></span>)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 type-meta">Development health order: Learning · Competency · Compliance · Professional development · Career. ● On track ▲ Attention ■ Action ○ Insufficient data.</p>
        </Panel>
      )}
    </div>
  );
}
