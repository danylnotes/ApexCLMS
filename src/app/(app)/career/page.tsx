import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { employeeOverview } from "@/server/services/overview";
import { HealthTable } from "@/components/health";
import { KeyValue, LinkButton, PageHeader, Panel, Progress, Status } from "@/components/ui";
import { HEALTH_STATUS_LABEL } from "@/lib/domain/health";
import { HEALTH_TONE, PLAN_TONE } from "@/lib/status";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Career Development" };

export default async function CareerPage() {
  const actor = await requireActor();
  const o = await employeeOverview(actor.id);
  const p = o.profile;
  const pathways = p?.jobRoleId ? await prisma.careerPathway.findMany({ where: { fromRoleId: p.jobRoleId }, include: { toRole: { include: { _count: { select: { requirements: true } } } } } }) : [];
  const yearsInCompany = p?.hireDate ? (Date.now() - p.hireDate.getTime()) / (365.25 * 86_400_000) : null;
  const gaps = o.target?.rows.filter((r) => r.evaluation && r.evaluation.gap > 0) ?? [];
  return (
    <div>
      <PageHeader eyebrow="Development" title="Career Development" description="A structured, evidence-based view of your development trajectory. Use it to prepare for development conversations with your manager." actions={<LinkButton href="/development-plan">Development plan</LinkButton>} />
      <section aria-labelledby="dims" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <h2 id="dims" className="sr-only">Dimension summary</h2>
        {o.health.map((d) => (
          <a key={d.key} href={`#dim-${d.key}`} className="rounded-[22px] bg-surface px-4 py-3 no-underline hover:border-line-strong">
            <p className="font-sans text-[0.8125rem] font-medium text-ink">{d.title}</p>
            <div className="mt-2"><Status tone={HEALTH_TONE[d.status]}>{HEALTH_STATUS_LABEL[d.status]}</Status></div>
          </a>
        ))}
      </section>
      <Panel title="Career Development Health" description="Status per dimension, with evidence, outstanding actions, next step and the date of the last review." id="dim-learning">
        <HealthTable dimensions={o.health} computedAt={o.computedAt} detailed />
      </Panel>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel title="Current and target role">
          <KeyValue items={[["Current role", p?.jobRole?.title], ["Target role", p?.targetJobRole?.title ?? "Not set"], ["Years with the organisation", yearsInCompany != null ? yearsInCompany.toFixed(1) : "—"], ["Typical experience for target", p?.targetJobRole?.minYearsExperience ? `${p.targetJobRole.minYearsExperience}+ years` : "Not configured"]]} />
          {o.target && o.target.rows.length > 0 && (
            <div className="mt-5">
              <p className="mb-1.5 type-eyebrow">Target-role competency readiness</p>
              <Progress value={o.target.summary.coveragePercent ?? 0} label="Target role competencies met" tone="copper" />
              <p className="mt-1 type-meta">{o.target.summary.met} of {o.target.summary.required} requirements met. <Link href="/competencies?view=target">View detail</Link></p>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 type-eyebrow">Skills needed for progression</p>
              <ul className="space-y-1.5 text-[0.875rem]">{gaps.slice(0, 6).map((g) => <li key={g.competency.id} className="flex justify-between gap-3"><span>{g.competency.name}</span><span className="type-meta">level {g.evaluation!.effectiveLevel} → {g.requiredLevel}</span></li>)}</ul>
            </div>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Possible next roles" description="Typical progression routes configured by HR.">
            {pathways.length === 0 ? <p className="type-meta">No progression routes are configured for your current role.</p> : (
              <ul className="divide-y divide-line">{pathways.map((pw) => <li key={pw.id} className="flex justify-between gap-3 py-2 text-[0.875rem] first:pt-0"><span className="font-medium">{pw.toRole.title}</span><span className="type-meta">typically {pw.typicalYears ?? "—"} years · {pw.toRole._count.requirements} competency requirements</span></li>)}</ul>
            )}
          </Panel>
          <Panel title="Development milestones" actions={<LinkButton href="/development-plan" size="sm" variant="ghost">Open plan</LinkButton>}>
            {!o.plan ? <p className="type-meta">No development plan yet. <Link href="/development-plan">Create one</Link> to agree objectives with your manager.</p> : (
              <>
                <p className="mb-3 text-[0.875rem]"><b>{o.plan.title}</b> <Status tone={PLAN_TONE[o.plan.status]}>{PLAN_STATUS_LABEL[o.plan.status]}</Status></p>
                <ul className="space-y-2 text-[0.875rem]">{o.plan.objectives.map((ob) => <li key={ob.id} className="flex justify-between gap-3"><span>{ob.goal}</span><span className="shrink-0 type-meta">{ob.status.replace("_", " ").toLowerCase()} · {fmtDate(ob.targetDate)}</span></li>)}</ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
