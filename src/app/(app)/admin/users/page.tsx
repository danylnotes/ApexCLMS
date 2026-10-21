import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, Notice, PageHeader, Pagination, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { importUsersAction } from "../../staff-actions";
import { getI18n } from "@/i18n/server";
import { UserForm } from "./user-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("User and Department Management") };
}

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }> }) {
  await requirePagePermission("user.manage");
  const { t } = await getI18n();
  const statusLabel: Record<string, string> = { ACTIVE: t("active"), INVITED: t("invited"), DEACTIVATED: t("deactivated") };
  const sp = await searchParams;
  const tab = sp.tab ?? "users";
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    ...(sp.status ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }, { profile: { employeeNumber: { contains: sp.q } } }] } : {}),
  };
  const [total, users] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * 25, take: 25, include: { profile: { include: { department: true, jobRole: true } }, roles: { include: { role: true } }, managedBy: { where: { endDate: null }, include: { manager: { select: { name: true } } } } } })]);
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Users and Organisation")} description={t("Create and invite users, manage reporting lines and role assignments, and import users from a validated CSV file.")} actions={<LinkButton href="/admin/organisation" variant="secondary">{t("Departments, roles and categories")}</LinkButton>} />
      <TabNav current={tab} tabs={[{ key: "users", label: t("Users"), href: "/admin/users", count: total }, { key: "new", label: t("Add user"), href: "/admin/users?tab=new" }, { key: "import", label: t("Bulk import (CSV)"), href: "/admin/users?tab=import" }]} />
      {tab === "users" && (
        <>
          <form className="mb-4 flex flex-wrap gap-2" action="/admin/users"><label htmlFor="q" className="sr-only">{t("Search users")}</label><input id="q" name="q" defaultValue={sp.q} placeholder={t("Name, email or employee no.")} className="input-base h-9 max-w-xs" /><label htmlFor="st" className="sr-only">{t("Status")}</label><select id="st" name="status" defaultValue={sp.status ?? ""} className="input-base h-9 w-40 !py-1"><option value="">{t("Any status")}</option><option value="ACTIVE">{t("Active")}</option><option value="INVITED">{t("Invited")}</option><option value="DEACTIVATED">{t("Deactivated")}</option></select><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">{t("Search")}</button></form>
          <Panel bodyClassName="pt-0">
            <Table caption={t("Users")}><thead><tr><Th>{t("User")}</Th><Th>{t("Role / department")}</Th><Th>{t("Line manager")}</Th><Th>{t("Platform roles")}</Th><Th>{t("Status")}</Th><Th>{t("Last sign-in")}</Th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.id}><Td><Link href={`/admin/users/${u.id}`} className="font-medium">{u.name}</Link><div className="type-meta">{u.email}{u.isDemo ? ` · ${t("demo")}` : ""}</div></Td><Td>{u.profile?.jobRole?.title ?? "—"}<div className="type-meta">{u.profile?.department?.name}</div></Td><Td>{u.managedBy.map((m) => m.manager.name).join(", ") || "—"}</Td><Td className="max-w-[180px]">{u.roles.map((r) => r.role.name).join(", ")}</Td><Td><Status tone={u.status === "ACTIVE" ? "ok" : u.status === "INVITED" ? "info" : "idle"}>{statusLabel[u.status] ?? u.status.toLowerCase()}</Status></Td><Td>{fmtDate(u.lastLoginAt)}</Td></tr>)}</tbody>
            </Table>
            <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/admin/users?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${sp.status ? `&status=${sp.status}` : ""}`} />
          </Panel>
        </>
      )}
      {tab === "new" && <Panel><UserForm /></Panel>}
      {tab === "import" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("Upload CSV")}>
            <ActionForm action={importUsersAction} className="space-y-4">
              <Field label={t("CSV file (max 2,000 rows, 1 MB)")} htmlFor="file"><input id="file" name="file" type="file" accept=".csv,text/csv" required className="block font-sans text-sm" /></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="invite" className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Send invitations to imported users")}</label>
              <SubmitButton>{t("Validate and import")}</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title={t("File format")}>
            <Notice tone="info">{t("The whole file is validated first. If any row has an error, nothing is imported and every problem is listed.")}</Notice>
            <pre className="mt-4 overflow-x-auto rounded bg-canvas p-3 font-mono text-[0.75rem]">{`name,email,employee_number,department_code,job_role_code,manager_email,roles
Sara Ali,sara.ali@example.com,E-1001,OPS,FO,omar.haddad@apex-demo.test,EMPLOYEE
Ken Ito,ken.ito@example.com,E-1002,ENG,PE,,EMPLOYEE;INSTRUCTOR`}</pre>
            <p className="mt-2 type-meta">{t("Codes refer to Departments and Job roles. Roles: {roles} (separate with “;”).", { roles: "EMPLOYEE, MANAGER, INSTRUCTOR, LD_ADMIN, EXECUTIVE" })}</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
