import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader, Pagination, Panel, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Audit Log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; page?: string }> }) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { ...(sp.action ? { action: { contains: sp.action } } : {}), ...(sp.entity ? { entityType: sp.entity } : {}) };
  const [total, rows, entities] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { name: true, email: true } } } }), prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } })]);
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Audit Log" description="Append-only record of sign-ins, approvals, assessments, configuration and administrative changes." />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/audit"><label htmlFor="a" className="sr-only">Action</label><input id="a" name="action" defaultValue={sp.action} placeholder="Action contains…" className="input-base h-9 max-w-xs" /><label htmlFor="e" className="sr-only">Entity</label><select id="e" name="entity" defaultValue={sp.entity ?? ""} className="input-base h-9 w-48 !py-1"><option value="">All entities</option>{entities.map((e) => <option key={e.entityType}>{e.entityType}</option>)}</select><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Filter</button></form>
      <Panel bodyClassName="pt-0">
        <Table caption="Audit events"><thead><tr><Th>Time (UTC)</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><Td className="whitespace-nowrap font-mono text-[0.75rem]">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</Td><Td>{r.actor?.name ?? "System"}{r.ip && <div className="type-meta">{r.ip}</div>}</Td><Td className="font-mono text-[0.75rem]">{r.action}</Td><Td>{r.entityType}<div className="type-meta font-mono">{r.entityId?.slice(0, 12)}</div></Td><Td className="max-w-md break-words font-mono text-[0.7rem] text-ink-muted">{r.metadata ? JSON.stringify(r.metadata).slice(0, 220) : ""}</Td></tr>)}</tbody>
        </Table>
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / 50))} hrefFor={(p) => `/admin/audit?page=${p}${sp.action ? `&action=${sp.action}` : ""}${sp.entity ? `&entity=${sp.entity}` : ""}`} />
      </Panel>
    </div>
  );
}
