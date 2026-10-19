import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reportingScope } from "@/server/policy";
import { buildProfile } from "@/server/services/competency";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Competency Gap Analysis" };

const CELL = {
  MET: "bg-ok-50 text-ok",
  GAP: "bg-warn-50 text-warn",
  EXPIRED: "bg-crit-50 text-crit",
  NOT_ASSESSED: "bg-idle-50 text-idle",
} as const;
const GLYPH = { MET: "●", GAP: "▲", EXPIRED: "■", NOT_ASSESSED: "○" } as const;

export default async function GapsPage() {
  const actor = await requirePagePermission("team.view");
  const scope = await reportingScope(actor.id);
  const users = await prisma.user.findMany({ where: { id: { in: scope }, status: "ACTIVE" }, include: { profile: { include: { jobRole: true } } }, orderBy: { name: "asc" } });
  const profiles = await Promise.all(users.map(async (u) => ({ user: u, prof: await buildProfile(u.id, u.profile?.jobRoleId ?? null) })));
  const comps = new Map<string, { id: string; code: string; name: string; domain: string }>();
  for (const p of profiles) for (const r of p.prof.rows) comps.set(r.competency.id, r.competency);
  const cols = [...comps.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.code.localeCompare(b.code));
  const colStats = cols.map((c) => {
    const rows = profiles.flatMap((p) => p.prof.rows.filter((r) => r.competency.id === c.id));
    return { id: c.id, unmet: rows.filter((r) => r.evaluation?.status !== "MET").length, total: rows.length };
  });
  return (
    <div>
      <PageHeader eyebrow="Management" title="Competency Gap Analysis" crumbs={[{ label: "Manager Dashboard", href: "/manager" }, { label: "Competency gaps" }]} description="Each cell compares the employee's current, demonstrated level with their role requirement. Use it to plan development and assessments — not to rank individuals." />
      {profiles.length === 0 || cols.length === 0 ? <EmptyState title="No competency requirements in scope" /> : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[0.75rem]">
              <caption className="sr-only">Competency gap matrix: employees by competency</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-[180px] border-b border-r border-line bg-surface px-4 py-2 text-left font-semibold">Employee</th>
                  {cols.map((c) => <th key={c.id} scope="col" className="h-36 min-w-[38px] border-b border-line px-1 align-bottom font-medium text-ink-muted"><span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180" title={c.name}>{c.code} {c.name.slice(0, 24)}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {profiles.map(({ user, prof }) => (
                  <tr key={user.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-surface px-4 py-2 text-left font-normal"><Link href={`/manager/team/${user.id}?tab=competency`} className="font-medium">{user.name}</Link><div className="text-ink-faint">{user.profile?.jobRole?.title}</div></th>
                    {cols.map((c) => {
                      const r = prof.rows.find((x) => x.competency.id === c.id);
                      if (!r?.evaluation) return <td key={c.id} className="border-b border-line text-center text-line-strong">·</td>;
                      const e = r.evaluation;
                      return <td key={c.id} className="border-b border-line p-0.5 text-center"><span className={`flex h-7 items-center justify-center rounded-[2px] ${CELL[e.status]}`} title={`${c.name}: level ${e.effectiveLevel} of ${e.requiredLevel} (${e.status.replace("_", " ").toLowerCase()})`}><span aria-hidden>{GLYPH[e.status]}</span><span className="ml-0.5 tabular-nums">{e.effectiveLevel}/{e.requiredLevel}</span></span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th scope="row" className="sticky left-0 border-r border-line bg-canvas px-4 py-2 text-left font-semibold">Unmet</th>{colStats.map((s) => <td key={s.id} className="bg-canvas py-2 text-center tabular-nums">{s.total ? `${s.unmet}/${s.total}` : ""}</td>)}</tr>
              </tfoot>
            </table>
          </div>
          <p className="px-5 py-3 type-meta">● meets requirement · ▲ development gap · ■ reassessment overdue · ○ not yet assessed · “·” not required for the role. Values show effective/required level; knowledge-only evidence counts as 0 under the current framework.</p>
        </Panel>
      )}
    </div>
  );
}
