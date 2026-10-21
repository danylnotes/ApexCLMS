import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS } from "@/lib/status";
import { fmtHours } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Learning Path Management") };
}

export default async function PathsAdmin() {
  await requirePagePermission("course.manage");
  const { t } = await getI18n();
  const paths = await prisma.learningPath.findMany({ orderBy: { title: "asc" }, include: { _count: { select: { items: true, enrollments: true } }, targetJobRole: true } });
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Learning Path Management")} actions={<LinkButton href="/admin/paths/new">{t("New learning path")}</LinkButton>} />
      <Panel bodyClassName="pt-0">
        <Table caption={t("Learning paths")}><thead><tr><Th>{t("Path")}</Th><Th>{t("Target role")}</Th><Th align="right">{t("Courses")}</Th><Th align="right">{t("Hours")}</Th><Th align="right">{t("Learners")}</Th><Th>{t("Status")}</Th></tr></thead>
          <tbody>{paths.map((p) => <tr key={p.id}><Td><Link href={`/admin/paths/${p.id}`} className="font-medium">{p.title}</Link><div className="type-meta">{p.code}</div></Td><Td>{p.targetJobRole?.title ?? "—"}</Td><Td align="right">{p._count.items}</Td><Td align="right">{fmtHours(p.expectedHours.toString())}</Td><Td align="right">{p._count.enrollments}</Td><Td><Status tone={COURSE_STATUS[p.status][1]}>{COURSE_STATUS[p.status][0]}</Status></Td></tr>)}</tbody>
        </Table>
      </Panel>
    </div>
  );
}
