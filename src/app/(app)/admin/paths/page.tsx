import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS } from "@/lib/status";
import { fmtHours } from "@/lib/format";

export const metadata = { title: "Learning Path Management" };

export default async function PathsAdmin() {
  await requirePagePermission("course.manage");
  const paths = await prisma.learningPath.findMany({ orderBy: { title: "asc" }, include: { _count: { select: { items: true, enrollments: true } }, targetJobRole: true } });
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Learning Path Management" actions={<LinkButton href="/admin/paths/new">New learning path</LinkButton>} />
      <Panel bodyClassName="pt-0">
        <Table caption="Learning paths"><thead><tr><Th>Path</Th><Th>Target role</Th><Th align="right">Courses</Th><Th align="right">Hours</Th><Th align="right">Learners</Th><Th>Status</Th></tr></thead>
          <tbody>{paths.map((p) => <tr key={p.id}><Td><Link href={`/admin/paths/${p.id}`} className="font-medium">{p.title}</Link><div className="type-meta">{p.code}</div></Td><Td>{p.targetJobRole?.title ?? "—"}</Td><Td align="right">{p._count.items}</Td><Td align="right">{fmtHours(p.expectedHours.toString())}</Td><Td align="right">{p._count.enrollments}</Td><Td><Status tone={COURSE_STATUS[p.status][1]}>{COURSE_STATUS[p.status][0]}</Status></Td></tr>)}</tbody>
        </Table>
      </Panel>
    </div>
  );
}
