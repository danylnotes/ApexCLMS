import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";
import { AnalyticsFiltersForm, AnalyticsView } from "@/components/analytics-view";
import { LinkButton, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Reporting and Analytics" };

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("reports.org");
  const sp = await searchParams;
  const now = new Date();
  const [a, history] = await Promise.all([computeAnalytics(null, parseAnalyticsFilters(sp, new Date(now.getFullYear(), 0, 1), now)), prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { generatedBy: { select: { name: true } } } })]);
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Reporting and Analytics" description="Organisation-wide learning, compliance and capability analytics computed from persisted records." actions={<><LinkButton href="/api/v1/exports/org-learning" variant="secondary">Learning export (CSV)</LinkButton><LinkButton href="/api/v1/exports/org-compliance" variant="secondary">Compliance export (CSV)</LinkButton></>} />
      <AnalyticsFiltersForm action="/admin/reports" sp={sp} />
      <AnalyticsView a={a} />
      <Panel title="Export log" className="mt-8" description="Sensitive exports are recorded." bodyClassName="pt-0">
        <Table caption="Export log"><thead><tr><Th>When</Th><Th>By</Th><Th>Report</Th><Th align="right">Rows</Th></tr></thead><tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.createdAt)}</Td><Td>{h.generatedBy.name}</Td><Td>{h.type}</Td><Td align="right">{h.rowCount}</Td></tr>)}</tbody></Table>
      </Panel>
    </div>
  );
}
