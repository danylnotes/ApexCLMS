import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS } from "@/lib/status";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Course Management" };

export default async function AdminCourses({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePagePermission("course.manage");
  const sp = await searchParams;
  const status = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"].includes(sp.status ?? "") ? (sp.status as "DRAFT") : undefined;
  const [courses, counts] = await Promise.all([
    prisma.course.findMany({
      where: { ...(status ? { status } : {}), ...(sp.q ? { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { code: { contains: sp.q, mode: "insensitive" } }] } : {}) },
      orderBy: [{ status: "asc" }, { code: "asc" }],
      include: { category: true, _count: { select: { enrollments: true, completions: true, modules: true } }, enrollments: { where: { status: "ACTIVE" }, select: { id: true } } },
    }),
    prisma.course.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Course Management" description="Create, edit, review, publish and archive courses. Content changes to published courses are audited." actions={<LinkButton href="/admin/courses/new">New course</LinkButton>} />
      <TabNav current={status ?? "all"} tabs={[{ key: "all", label: "All", href: "/admin/courses", count: counts.reduce((s, x) => s + x._count, 0) }, ...["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"].map((s) => ({ key: s, label: COURSE_STATUS[s][0], href: `/admin/courses?status=${s}`, count: c(s) }))]} />
      <form className="mb-4 flex gap-2" action="/admin/courses">{status && <input type="hidden" name="status" value={status} />}<label htmlFor="q" className="sr-only">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search title or code" className="input-base h-9 max-w-xs" /><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Search</button></form>
      <Panel bodyClassName="pt-0">
        <Table caption="Courses">
          <thead><tr><Th>Course</Th><Th>Category</Th><Th>Status</Th><Th align="right">Modules</Th><Th align="right">Active</Th><Th align="right">Completed</Th><Th>Updated</Th></tr></thead>
          <tbody>{courses.map((x) => <tr key={x.id}><Td><Link href={`/admin/courses/${x.id}`} className="font-medium">{x.title}</Link><div className="type-meta">{x.code}{x.isMandatory ? " · mandatory" : ""}</div></Td><Td>{x.category.name}</Td><Td><Status tone={COURSE_STATUS[x.status][1]}>{COURSE_STATUS[x.status][0]}</Status></Td><Td align="right">{x._count.modules}</Td><Td align="right">{x.enrollments.length}</Td><Td align="right">{x._count.completions}</Td><Td>{fmtDate(x.updatedAt)}</Td></tr>)}</tbody>
        </Table>
      </Panel>
    </div>
  );
}
