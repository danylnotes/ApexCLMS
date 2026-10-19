import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reportingScope } from "@/server/policy";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";
import { AnalyticsFiltersForm, AnalyticsView } from "@/components/analytics-view";
import { LinkButton, PageHeader, Panel, Status } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Manager Dashboard" };

export default async function ManagerDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePagePermission("team.view");
  const sp = await searchParams;
  const scope = await reportingScope(actor.id);
  const now = new Date();
  const f = parseAnalyticsFilters(sp, new Date(now.getFullYear(), 0, 1), now);
  const [a, plans, requests, enrolments, overdue] = await Promise.all([
    computeAnalytics(scope, f),
    prisma.developmentPlan.findMany({ where: { userId: { in: scope }, status: "MANAGER_REVIEW" }, include: { user: { select: { name: true } } } }),
    prisma.competencyReviewRequest.findMany({ where: { userId: { in: scope }, status: "PENDING" }, include: { user: { select: { name: true } }, competency: true } }),
    prisma.enrollment.findMany({ where: { userId: { in: scope }, status: "PENDING_APPROVAL" }, include: { user: { select: { name: true } }, course: { select: { title: true } } } }),
    prisma.learningAssignment.findMany({ where: { userId: { in: scope }, status: "ASSIGNED", dueDate: { lt: now } }, include: { user: { select: { id: true, name: true } }, course: { select: { title: true } }, path: { select: { title: true } } }, orderBy: { dueDate: "asc" } }),
  ]);
  const pending = plans.length + requests.length + enrolments.length;
  return (
    <div>
      <PageHeader eyebrow="Management" title="Manager Dashboard" description={`Learning and capability across your reporting line (${scope.length} employees, including indirect reports).`} actions={<><LinkButton href="/manager/team" variant="secondary">Team learning</LinkButton><LinkButton href="/manager/assign">Assign learning</LinkButton></>} />
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Awaiting your decision" description={pending ? `${pending} item${pending === 1 ? "" : "s"}` : "Nothing waiting"}>
          <ul className="space-y-2 text-[0.875rem]">
            {plans.map((p) => <li key={p.id} className="flex justify-between gap-3"><Link href={`/manager/team/${p.userId}?tab=plan`}>Review development plan — {p.user.name}</Link><Status tone="warn">Plan review</Status></li>)}
            {requests.map((r) => <li key={r.id} className="flex justify-between gap-3"><Link href={`/manager/team/${r.userId}?tab=competency`}>{r.competency.name} (level {r.requestedLevel}) — {r.user.name}</Link><Status tone="info">Assessment request</Status></li>)}
            {enrolments.map((e) => <li key={e.id} className="flex justify-between gap-3"><Link href="/manager/assign?tab=requests">{e.course.title} — {e.user.name}</Link><Status tone="info">Enrolment approval</Status></li>)}
            {pending === 0 && <li className="type-meta">No plans, assessment requests or enrolment approvals are waiting.</li>}
          </ul>
        </Panel>
        <Panel title="Overdue learning" description={`${overdue.length} overdue assignment${overdue.length === 1 ? "" : "s"}`}>
          <ul className="space-y-2 text-[0.875rem]">
            {overdue.slice(0, 8).map((o) => <li key={o.id} className="flex justify-between gap-3"><Link href={`/manager/team/${o.user.id}?tab=learning`}>{o.user.name} — {o.course?.title ?? o.path?.title}</Link><span className="shrink-0">{o.isMandatory && <Status tone="crit">Mandatory</Status>} <span className="type-meta">due {fmtDate(o.dueDate)}</span></span></li>)}
            {overdue.length === 0 && <li className="type-meta">No overdue assignments.</li>}
          </ul>
        </Panel>
      </div>
      <AnalyticsFiltersForm action="/manager" sp={sp} />
      <AnalyticsView a={a} drillHref={(d) => `/manager/team?department=${encodeURIComponent(d)}`} />
    </div>
  );
}
