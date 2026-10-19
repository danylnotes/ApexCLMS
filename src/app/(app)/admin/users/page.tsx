import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, Notice, PageHeader, Pagination, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { importUsersAction } from "../../staff-actions";
import { UserForm } from "./user-form";

export const metadata = { title: "User and Department Management" };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }> }) {
  await requirePagePermission("user.manage");
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
      <PageHeader eyebrow="Administration" title="Users and Organisation" description="Create and invite users, manage reporting lines and role assignments, and import users from a validated CSV file." actions={<LinkButton href="/admin/organisation" variant="secondary">Departments, roles and categories</LinkButton>} />
      <TabNav current={tab} tabs={[{ key: "users", label: "Users", href: "/admin/users", count: total }, { key: "new", label: "Add user", href: "/admin/users?tab=new" }, { key: "import", label: "Bulk import (CSV)", href: "/admin/users?tab=import" }]} />
      {tab === "users" && (
        <>
          <form className="mb-4 flex flex-wrap gap-2" action="/admin/users"><label htmlFor="q" className="sr-only">Search users</label><input id="q" name="q" defaultValue={sp.q} placeholder="Name, email or employee no." className="input-base h-9 max-w-xs" /><label htmlFor="st" className="sr-only">Status</label><select id="st" name="status" defaultValue={sp.status ?? ""} className="input-base h-9 w-40 !py-1"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="INVITED">Invited</option><option value="DEACTIVATED">Deactivated</option></select><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Search</button></form>
          <Panel bodyClassName="pt-0">
            <Table caption="Users"><thead><tr><Th>User</Th><Th>Role / department</Th><Th>Line manager</Th><Th>Platform roles</Th><Th>Status</Th><Th>Last sign-in</Th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.id}><Td><Link href={`/admin/users/${u.id}`} className="font-medium">{u.name}</Link><div className="type-meta">{u.email}{u.isDemo ? " · demo" : ""}</div></Td><Td>{u.profile?.jobRole?.title ?? "—"}<div className="type-meta">{u.profile?.department?.name}</div></Td><Td>{u.managedBy.map((m) => m.manager.name).join(", ") || "—"}</Td><Td className="max-w-[180px]">{u.roles.map((r) => r.role.name).join(", ")}</Td><Td><Status tone={u.status === "ACTIVE" ? "ok" : u.status === "INVITED" ? "info" : "idle"}>{u.status.toLowerCase()}</Status></Td><Td>{fmtDate(u.lastLoginAt)}</Td></tr>)}</tbody>
            </Table>
            <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/admin/users?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${sp.status ? `&status=${sp.status}` : ""}`} />
          </Panel>
        </>
      )}
      {tab === "new" && <Panel><UserForm /></Panel>}
      {tab === "import" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Upload CSV">
            <ActionForm action={importUsersAction} className="space-y-4">
              <Field label="CSV file (max 2,000 rows, 1 MB)" htmlFor="file"><input id="file" name="file" type="file" accept=".csv,text/csv" required className="block font-sans text-sm" /></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="invite" className="h-4 w-4 accent-[rgb(22,38,68)]" />Send invitations to imported users</label>
              <SubmitButton>Validate and import</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="File format">
            <Notice tone="info">The whole file is validated first. If any row has an error, nothing is imported and every problem is listed.</Notice>
            <pre className="mt-4 overflow-x-auto rounded bg-canvas p-3 font-mono text-[0.75rem]">{`name,email,employee_number,department_code,job_role_code,manager_email,roles
Sara Ali,sara.ali@example.com,E-1001,OPS,FO,omar.haddad@apex-demo.test,EMPLOYEE
Ken Ito,ken.ito@example.com,E-1002,ENG,PE,,EMPLOYEE;INSTRUCTOR`}</pre>
            <p className="mt-2 type-meta">Codes refer to Departments and Job roles. Roles: EMPLOYEE, MANAGER, INSTRUCTOR, LD_ADMIN, EXECUTIVE (separate with “;”).</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
