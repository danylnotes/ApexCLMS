import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { webinarPhase } from "@/server/services/webinars";
import { LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { WEBINAR_PHASE } from "@/lib/status";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Webinar Management" };

export default async function WebinarsAdmin() {
  await requirePagePermission("webinar.manage");
  const ws = await prisma.webinar.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { registrations: { where: { status: "REGISTERED" } }, attendance: { where: { attended: true } }, recordings: true } }, attendance: { where: { attended: true, verification: { not: "UNVERIFIED" }, cpdProcessedAt: null }, select: { id: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Webinar Management" description="Schedule sessions, manage registrations, verify attendance, publish recordings and process CPD." actions={<LinkButton href="/admin/webinars/new">Schedule webinar</LinkButton>} />
      <Panel bodyClassName="pt-0">
        <Table caption="Webinars"><thead><tr><Th>Webinar</Th><Th>Starts</Th><Th>Status</Th><Th align="right">Registered</Th><Th align="right">Attended</Th><Th>CPD</Th></tr></thead>
          <tbody>{ws.map((w) => { const ph = webinarPhase(w); return <tr key={w.id}><Td><Link href={`/admin/webinars/${w.id}`} className="font-medium">{w.title}</Link><div className="type-meta">{w.code} · {w.speakerName}</div></Td><Td>{fmtDateTime(w.startsAt, w.timeZone)}</Td><Td><Status tone={WEBINAR_PHASE[ph][1]}>{WEBINAR_PHASE[ph][0]}</Status></Td><Td align="right">{w._count.registrations}{w.capacity ? ` / ${w.capacity}` : ""}</Td><Td align="right">{w._count.attendance}</Td><Td>{!w.cpdEligible ? "—" : w.attendance.length ? <Status tone="warn">{w.attendance.length} to process</Status> : "Up to date"}</Td></tr>; })}</tbody>
        </Table>
      </Panel>
    </div>
  );
}
