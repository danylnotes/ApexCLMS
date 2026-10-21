import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";
import { AnalyticsFiltersForm, AnalyticsView } from "@/components/analytics-view";
import { LinkButton, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Reporting and Analytics") };
}

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("reports.org");
  const { t } = await getI18n();
  const sp = await searchParams;
  const now = new Date();
  const [a, history] = await Promise.all([computeAnalytics(null, parseAnalyticsFilters(sp, new Date(now.getFullYear(), 0, 1), now)), prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { generatedBy: { select: { name: true } } } })]);
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Reporting and Analytics")} description={t("Organisation-wide learning, compliance and capability analytics computed from persisted records.")} actions={<><LinkButton href="/api/v1/exports/org-learning" variant="secondary">{t("Learning export (CSV)")}</LinkButton><LinkButton href="/api/v1/exports/org-compliance" variant="secondary">{t("Compliance export (CSV)")}</LinkButton></>} />
      <AnalyticsFiltersForm action="/admin/reports" sp={sp} />
      <AnalyticsView a={a} />
      <Panel title={t("Export log")} className="mt-8" description={t("Sensitive exports are recorded.")} bodyClassName="pt-0">
        <Table caption={t("Export log")}><thead><tr><Th>{t("When")}</Th><Th>{t("By")}</Th><Th>{t("Report")}</Th><Th align="right">{t("Rows")}</Th></tr></thead><tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.createdAt)}</Td><Td>{h.generatedBy.name}</Td><Td>{h.type}</Td><Td align="right">{h.rowCount}</Td></tr>)}</tbody></Table>
      </Panel>
    </div>
  );
}
