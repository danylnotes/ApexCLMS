import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { webinarPhase } from "@/server/services/webinars";
import { LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { WEBINAR_PHASE } from "@/lib/status";
import { fmtDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Webinar Management") };
}

export default async function WebinarsAdmin() {
  await requirePagePermission("webinar.manage");
  const { t } = await getI18n();
  const ws = await prisma.webinar.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { registrations: { where: { status: "REGISTERED" } }, attendance: { where: { attended: true } }, recordings: true } }, attendance: { where: { attended: true, verification: { not: "UNVERIFIED" }, cpdProcessedAt: null }, select: { id: true } } } });
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Webinar Management")} description={t("Schedule sessions, manage registrations, verify attendance, publish recordings and process CPD.")} actions={<LinkButton href="/admin/webinars/new">{t("Schedule webinar")}</LinkButton>} />
      <Panel bodyClassName="pt-0">
        <Table caption={t("Webinars")}><thead><tr><Th>{t("Webinar")}</Th><Th>{t("Starts")}</Th><Th>{t("Status")}</Th><Th align="right">{t("Registered")}</Th><Th align="right">{t("Attended")}</Th><Th>{t("CPD")}</Th></tr></thead>
          <tbody>{ws.map((w) => { const ph = webinarPhase(w); return <tr key={w.id}><Td><Link href={`/admin/webinars/${w.id}`} className="font-medium">{w.title}</Link><div className="type-meta">{w.code} · {w.speakerName}</div></Td><Td>{fmtDateTime(w.startsAt, w.timeZone)}</Td><Td><Status tone={WEBINAR_PHASE[ph][1]}>{WEBINAR_PHASE[ph][0]}</Status></Td><Td align="right">{w._count.registrations}{w.capacity ? ` / ${w.capacity}` : ""}</Td><Td align="right">{w._count.attendance}</Td><Td>{!w.cpdEligible ? "—" : w.attendance.length ? <Status tone="warn">{t("{count} to process", { count: w.attendance.length })}</Status> : t("Up to date")}</Td></tr>; })}</tbody>
        </Table>
      </Panel>
    </div>
  );
}
