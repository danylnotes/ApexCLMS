import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PERMISSIONS } from "@/server/permissions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice, PageHeader, Panel } from "@/components/ui";
import { rolePermissionAction } from "../../staff-actions";

export const metadata = { title: "Role and Permission Management" };

export default async function RolesAdmin() {
  await requirePagePermission("role.manage");
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  const groups = [...new Set(Object.values(PERMISSIONS).map((p) => p.group))];
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Roles and Permissions" description="Permissions are enforced on the server for every page, action and API request. Changes take effect at each user's next request and are recorded in the audit log." />
      <div className="mb-6"><Notice tone="warn" title="Least privilege">Grant only what each role needs. Reporting-scope rules still apply: managers see only their reporting line regardless of the permissions granted here.</Notice></div>
      <div className="grid gap-6 xl:grid-cols-2">
        {roles.map((r) => {
          const has = new Set(r.permissions.map((p) => p.permission.key));
          return (
            <Panel key={r.id} title={r.name} description={`${r.description ?? ""} · ${r._count.users} user${r._count.users === 1 ? "" : "s"} · key ${r.key}`}>
              <ActionForm action={rolePermissionAction}>
                <input type="hidden" name="roleId" value={r.id} />
                {groups.map((g) => (
                  <fieldset key={g} className="mb-3">
                    <legend className="type-eyebrow mb-1">{g}</legend>
                    {Object.entries(PERMISSIONS).filter(([, p]) => p.group === g).map(([k, p]) => (
                      <label key={k} className="flex items-start gap-2 py-0.5 text-[0.8125rem]"><input type="checkbox" name="permissions" value={k} defaultChecked={has.has(k)} className="mt-0.5 h-4 w-4 accent-[rgb(22,38,68)]" /><span><span className="font-mono text-[0.75rem] text-ink-muted">{k}</span> — {p.description}</span></label>
                    ))}
                  </fieldset>
                ))}
                <SubmitButton size="sm">Save {r.name}</SubmitButton>
              </ActionForm>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
