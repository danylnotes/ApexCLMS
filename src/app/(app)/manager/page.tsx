import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reportingScope } from "@/server/policy";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";
import { AnalyticsFiltersForm, AnalyticsView } from "@/components/analytics-view";
import { LinkButton, PageHeader, Panel, Status } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Manager Dashboard") };
}

export default async function ManagerDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePagePermission("team.view");
  const { t } = await getI18n();
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
      <PageHeader eyebrow={t("Management")} title={t("Manager Dashboard")} description={t("Learning and capability across your reporting line ({count, plural, one {# employee} other {# employees}}, including indirect reports).", { count: scope.length })} actions={<><LinkButton href="/manager/team" variant="secondary">{t("Team learning")}</LinkButton><LinkButton href="/manager/assign">{t("Assign learning")}</LinkButton></>} />
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Panel title={t("Awaiting your decision")} description={pending ? t("{count, plural, one {# item} other {# items}}", { count: pending }) : t("Nothing waiting")}>
          <ul className="space-y-2 text-[0.875rem]">
            {plans.map((p) => <li key={p.id} className="flex justify-between gap-3"><Link href={`/manager/team/${p.userId}?tab=plan`}>{t("Review development plan — {name}", { name: p.user.name })}</Link><Status tone="warn">{t("Plan review")}</Status></li>)}
            {requests.map((r) => <li key={r.id} className="flex justify-between gap-3"><Link href={`/manager/team/${r.userId}?tab=competency`}>{t("{competency} (level {level}) — {name}", { competency: r.competency.name, level: r.requestedLevel, name: r.user.name })}</Link><Status tone="info">{t("Assessment request")}</Status></li>)}
            {enrolments.map((e) => <li key={e.id} className="flex justify-between gap-3"><Link href="/manager/assign?tab=requests">{e.course.title} — {e.user.name}</Link><Status tone="info">{t("Enrolment approval")}</Status></li>)}
            {pending === 0 && <li className="type-meta">{t("No plans, assessment requests or enrolment approvals are waiting.")}</li>}
          </ul>
        </Panel>
        <Panel title={t("Overdue learning")} description={t("{count, plural, one {# overdue assignment} other {# overdue assignments}}", { count: overdue.length })}>
          <ul className="space-y-2 text-[0.875rem]">
            {overdue.slice(0, 8).map((o) => <li key={o.id} className="flex justify-between gap-3"><Link href={`/manager/team/${o.user.id}?tab=learning`}>{o.user.name} — {o.course?.title ?? o.path?.title}</Link><span className="shrink-0">{o.isMandatory && <Status tone="crit">{t("Mandatory")}</Status>} <span className="type-meta">{t("due {date}", { date: fmtDate(o.dueDate) })}</span></span></li>)}
            {overdue.length === 0 && <li className="type-meta">{t("No overdue assignments.")}</li>}
          </ul>
        </Panel>
      </div>
      <AnalyticsFiltersForm action="/manager" sp={sp} />
      <AnalyticsView a={a} drillHref={(d) => `/manager/team?department=${encodeURIComponent(d)}`} />
    </div>
  );
}
