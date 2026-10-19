import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Training Reports" };

export default async function TeamReports() {
  const actor = await requirePagePermission("team.view");
  const history = await prisma.report.findMany({ where: { generatedById: actor.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const reports = [
    { type: "team-learning", title: "Team learning summary", body: "Enrolments, completions, recorded learning hours and mandatory status per employee in your reporting line." },
    { type: "team-compliance", title: "Mandatory training compliance", body: "Every mandatory assignment in your reporting line with due date, completion date and current status." },
  ];
  return (
    <div>
      <PageHeader eyebrow="Management" title="Training Reports" description="Reports are generated from verified records for your authorised scope only. Each export is logged." />
      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((r) => (
          <Panel key={r.type} title={r.title} actions={<LinkButton href={`/api/v1/exports/${r.type}`} size="sm">Download CSV</LinkButton>}><p className="text-[0.9rem] text-ink-muted">{r.body}</p></Panel>
        ))}
      </div>
      <Panel title="Your recent exports" className="mt-8" bodyClassName="pt-0">
        {history.length === 0 ? <p className="pt-4 type-meta">No exports yet.</p> : (
          <Table caption="Export history"><thead><tr><Th>Date</Th><Th>Report</Th><Th align="right">Rows</Th></tr></thead><tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.createdAt)}</Td><Td>{h.type}</Td><Td align="right">{h.rowCount}</Td></tr>)}</tbody></Table>
        )}
      </Panel>
    </div>
  );
}
