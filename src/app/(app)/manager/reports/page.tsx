import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Training Reports") };
}

export default async function TeamReports() {
  const actor = await requirePagePermission("team.view");
  const { t } = await getI18n();
  const history = await prisma.report.findMany({ where: { generatedById: actor.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const reports = [
    { type: "team-learning", title: t("Team learning summary"), body: t("Enrolments, completions, recorded learning hours and mandatory status per employee in your reporting line.") },
    { type: "team-compliance", title: t("Mandatory training compliance"), body: t("Every mandatory assignment in your reporting line with due date, completion date and current status.") },
  ];
  return (
    <div>
      <PageHeader eyebrow={t("Management")} title={t("Training Reports")} description={t("Reports are generated from verified records for your authorised scope only. Each export is logged.")} />
      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((r) => (
          <Panel key={r.type} title={r.title} actions={<LinkButton href={`/api/v1/exports/${r.type}`} size="sm">{t("Download CSV")}</LinkButton>}><p className="text-[0.9rem] text-ink-muted">{r.body}</p></Panel>
        ))}
      </div>
      <Panel title={t("Your recent exports")} className="mt-8" bodyClassName="pt-0">
        {history.length === 0 ? <p className="pt-4 type-meta">{t("No exports yet.")}</p> : (
          <Table caption={t("Export history")}><thead><tr><Th>{t("Date")}</Th><Th>{t("Report")}</Th><Th align="right">{t("Rows")}</Th></tr></thead><tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.createdAt)}</Td><Td>{h.type}</Td><Td align="right">{h.rowCount}</Td></tr>)}</tbody></Table>
        )}
      </Panel>
    </div>
  );
}
