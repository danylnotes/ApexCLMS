import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { orgDataAction } from "../../staff-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Organisation configuration") };
}

export default async function OrganisationAdmin() {
  await requirePagePermission("user.manage");
  const { t } = await getI18n();
  const [units, departments, roles, categories] = await Promise.all([
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, include: { businessUnit: true, _count: { select: { profiles: true } } } }),
    prisma.jobRole.findMany({ orderBy: { title: "asc" }, include: { department: true, _count: { select: { currentHolders: true, requirements: true } } } }),
    prisma.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: true } } } }),
  ]);
  return (
    <div>
      <PageHeader crumbs={[{ label: t("Users"), href: "/admin/users" }, { label: t("Organisation") }]} eyebrow={t("Administration")} title={t("Departments, Job Roles and Categories")} description={t("Reference data used across learning, competency and reporting. Changes are audited.")} />
      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title={t("Departments")} bodyClassName="pt-0">
          <Table caption={t("Departments")}><thead><tr><Th>{t("Code")}</Th><Th>{t("Name")}</Th><Th>{t("Business unit")}</Th><Th align="right">{t("People")}</Th></tr></thead><tbody>{departments.map((d) => <tr key={d.id}><Td className="font-mono text-[0.75rem]">{d.code}</Td><Td>{d.name}</Td><Td>{d.businessUnit?.name}</Td><Td align="right">{d._count.profiles}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-[90px_1fr_1fr_auto]" resetOnSuccess><input type="hidden" name="op" value="department" /><input name="code" placeholder={t("Code")} aria-label={t("Code")} required className="input-base uppercase" /><input name="name" placeholder={t("Name")} aria-label={t("Name")} required className="input-base" /><select name="businessUnitId" aria-label={t("Business unit")} className="input-base"><option value="">{t("No unit")}</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><SubmitButton size="sm">{t("Save")}</SubmitButton></ActionForm>
          <p className="mt-1 type-meta">{t("Saving an existing code updates its name and unit.")}</p>
        </Panel>
        <Panel title={t("Business units")} bodyClassName="pt-0">
          <Table caption={t("Business units")}><thead><tr><Th>{t("Code")}</Th><Th>{t("Name")}</Th></tr></thead><tbody>{units.map((u) => <tr key={u.id}><Td className="font-mono text-[0.75rem]">{u.code}</Td><Td>{u.name}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-[90px_1fr_auto]" resetOnSuccess><input type="hidden" name="op" value="unit" /><input name="code" placeholder={t("Code")} aria-label={t("Code")} required className="input-base uppercase" /><input name="name" placeholder={t("Name")} aria-label={t("Name")} required className="input-base" /><SubmitButton size="sm">{t("Save")}</SubmitButton></ActionForm>
        </Panel>
        <Panel title={t("Job roles")} bodyClassName="pt-0">
          <Table caption={t("Job roles")}><thead><tr><Th>{t("Code")}</Th><Th>{t("Title")}</Th><Th>{t("Department")}</Th><Th align="right">{t("Holders")}</Th><Th align="right">{t("Requirements")}</Th></tr></thead><tbody>{roles.map((r) => <tr key={r.id}><Td className="font-mono text-[0.75rem]">{r.code}</Td><Td>{r.title}<div className="type-meta">{r.careerTrack}{r.grade ? ` · ${t("grade {grade}", { grade: r.grade })}` : ""}</div></Td><Td>{r.department?.name}</Td><Td align="right">{r._count.currentHolders}</Td><Td align="right">{r._count.requirements}</Td></tr>)}</tbody></Table>
          <ActionForm action={orgDataAction} className="mt-4 grid gap-2 sm:grid-cols-3" resetOnSuccess><input type="hidden" name="op" value="jobRole" /><input name="code" placeholder={t("Code")} aria-label={t("Code")} required className="input-base uppercase" /><input name="title" placeholder={t("Title")} aria-label={t("Title")} required className="input-base sm:col-span-2" /><select name="departmentId" aria-label={t("Department")} className="input-base"><option value="">{t("No department")}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input name="careerTrack" placeholder={t("Career track")} aria-label={t("Career track")} className="input-base" /><input name="grade" type="number" placeholder={t("Grade")} aria-label={t("Grade")} className="input-base" /><input name="minYears" type="number" placeholder={t("Min. years experience")} aria-label={t("Minimum years experience")} className="input-base" /><SubmitButton size="sm">{t("Save")}</SubmitButton></ActionForm>
        </Panel>
        <Panel title={t("Course categories")} bodyClassName="pt-0">
          <Table caption={t("Categories")}><thead><tr><Th>{t("Name")}</Th><Th align="right">{t("Courses")}</Th><Th>{t("Status")}</Th><Th /></tr></thead>
            <tbody>{categories.map((c) => <tr key={c.id}><Td colSpan={4}><ActionForm action={orgDataAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="op" value="category" /><input type="hidden" name="categoryId" value={c.id} /><input name="name" defaultValue={c.name} aria-label={t("Category name")} className="input-base h-8 max-w-xs" /><input type="hidden" name="description" value={c.description ?? ""} /><span className="type-meta w-16 text-end">{t("{count, plural, one {# course} other {# courses}}", { count: c._count.courses })}</span><label className="flex items-center gap-1 text-[0.8125rem]"><input type="checkbox" name="inactive" defaultChecked={!c.isActive} className="h-4 w-4" />{t("Inactive")}</label><SubmitButton size="sm" variant="ghost">{t("Save")}</SubmitButton></ActionForm></Td></tr>)}</tbody>
          </Table>
          <ActionForm action={orgDataAction} className="mt-4 flex gap-2" resetOnSuccess><input type="hidden" name="op" value="category" /><input name="name" placeholder={t("New category")} aria-label={t("New category name")} required className="input-base" /><input type="hidden" name="description" value="" /><SubmitButton size="sm">{t("Add")}</SubmitButton></ActionForm>
        </Panel>
      </div>
    </div>
  );
}
