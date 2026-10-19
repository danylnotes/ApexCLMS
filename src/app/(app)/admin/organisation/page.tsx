import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { orgDataAction } from "../../staff-actions";

export const metadata = { title: "Organisation configuration" };

export default async function OrganisationAdmin() {
  await requirePagePermission("user.manage");
  const [units, departments, roles, categories] = await Promise.all([
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, include: { businessUnit: true, _count: { select: { profiles: true } } } }),
    prisma.jobRole.findMany({ orderBy: { title: "asc" }, include: { department: true, _count: { select: { currentHolders: true, requirements: true } } } }),
    prisma.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: true } } } }),
  ]);
  return (
    <div>
      <PageHeader crumbs={[{ label: "Users", href: "/admin/users" }, { label: "Organisation" }]} eyebrow="Administration" title="Departments, Job Roles and Categories" description="Reference data used across learning, competency and reporting. Changes are audited." />
      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="Departments" bodyClassName="pt-0">
          <Table caption="Departments"><thead><tr><Th>Code</Th><Th>Name</Th><Th>Business unit</Th><Th align="right">People</Th></tr></thead><tbody>{departments.map((d) => <tr key={d.id}><Td className="font-mono text-[0.75rem]">{d.code}</Td><Td>{d.name}</Td><Td>{d.businessUnit?.name}</Td><Td align="right">{d._count.profiles}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-[90px_1fr_1fr_auto]" resetOnSuccess><input type="hidden" name="op" value="department" /><input name="code" placeholder="Code" aria-label="Code" required className="input-base uppercase" /><input name="name" placeholder="Name" aria-label="Name" required className="input-base" /><select name="businessUnitId" aria-label="Business unit" className="input-base"><option value="">No unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><SubmitButton size="sm">Save</SubmitButton></ActionForm>
          <p className="mt-1 type-meta">Saving an existing code updates its name and unit.</p>
        </Panel>
        <Panel title="Business units" bodyClassName="pt-0">
          <Table caption="Business units"><thead><tr><Th>Code</Th><Th>Name</Th></tr></thead><tbody>{units.map((u) => <tr key={u.id}><Td className="font-mono text-[0.75rem]">{u.code}</Td><Td>{u.name}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-[90px_1fr_auto]" resetOnSuccess><input type="hidden" name="op" value="unit" /><input name="code" placeholder="Code" aria-label="Code" required className="input-base uppercase" /><input name="name" placeholder="Name" aria-label="Name" required className="input-base" /><SubmitButton size="sm">Save</SubmitButton></ActionForm>
        </Panel>
        <Panel title="Job roles" bodyClassName="pt-0">
          <Table caption="Job roles"><thead><tr><Th>Code</Th><Th>Title</Th><Th>Department</Th><Th align="right">Holders</Th><Th align="right">Requirements</Th></tr></thead><tbody>{roles.map((r) => <tr key={r.id}><Td className="font-mono text-[0.75rem]">{r.code}</Td><Td>{r.title}<div className="type-meta">{r.careerTrack}{r.grade ? ` · grade ${r.grade}` : ""}</div></Td><Td>{r.department?.name}</Td><Td align="right">{r._count.currentHolders}</Td><Td align="right">{r._count.requirements}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-3" resetOnSuccess><input type="hidden" name="op" value="jobRole" /><input name="code" placeholder="Code" aria-label="Code" required className="input-base uppercase" /><input name="title" placeholder="Title" aria-label="Title" required className="input-base sm:col-span-2" /><select name="departmentId" aria-label="Department" className="input-base"><option value="">No department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input name="careerTrack" placeholder="Career track" aria-label="Career track" className="input-base" /><input name="grade" type="number" placeholder="Grade" aria-label="Grade" className="input-base" /><input name="minYears" type="number" placeholder="Min. years experience" aria-label="Minimum years experience" className="input-base" /><SubmitButton size="sm">Save</SubmitButton></ActionForm>
        </Panel>
        <Panel title="Course categories" bodyClassName="pt-0">
          <Table caption="Categories"><thead><tr><Th>Name</Th><Th align="right">Courses</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{categories.map((c) => <tr key={c.id}><Td colSpan={4}><ActionForm action={orgDataAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="op" value="category" /><input type="hidden" name="categoryId" value={c.id} /><input name="name" defaultValue={c.name} aria-label="Category name" className="input-base h-8 max-w-xs" /><input type="hidden" name="description" value={c.description ?? ""} /><span className="type-meta w-16 text-right">{c._count.courses} courses</span><label className="flex items-center gap-1 text-[0.8125rem]"><input type="checkbox" name="inactive" defaultChecked={!c.isActive} className="h-4 w-4" />Inactive</label><SubmitButton size="sm" variant="ghost">Save</SubmitButton></ActionForm></Td></tr>)}</tbody>
          </Table>
          <ActionForm action={orgDataAction} className="mt-4 flex gap-2" resetOnSuccess><input type="hidden" name="op" value="category" /><input name="name" placeholder="New category" aria-label="New category name" required className="input-base" /><input type="hidden" name="description" value="" /><SubmitButton size="sm">Add</SubmitButton></ActionForm>
        </Panel>
      </div>
    </div>
  );
}
