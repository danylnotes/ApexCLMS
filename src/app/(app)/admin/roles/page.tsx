import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PERMISSIONS } from "@/server/permissions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice, PageHeader, Panel } from "@/components/ui";
import { rolePermissionAction } from "../../staff-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Role and Permission Management") };
}

export default async function RolesAdmin() {
  await requirePagePermission("role.manage");
  const { t } = await getI18n();
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  const groups = [...new Set(Object.values(PERMISSIONS).map((p) => p.group))];
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Roles and Permissions")} description={t("Permissions are enforced on the server for every page, action and API request. Changes take effect at each user's next request and are recorded in the audit log.")} />
      <div className="mb-6"><Notice tone="warn" title={t("Least privilege")}>{t("Grant only what each role needs. Reporting-scope rules still apply: managers see only their reporting line regardless of the permissions granted here.")}</Notice></div>
      <div className="grid gap-6 xl:grid-cols-2">
        {roles.map((r) => {
          const has = new Set(r.permissions.map((p) => p.permission.key));
          return (
            <Panel key={r.id} title={r.name} description={`${r.description ?? ""} · ${t("{count, plural, one {# user} other {# users}}", { count: r._count.users })} · ${t("key {key}", { key: r.key })}`}>
              <ActionForm action={rolePermissionAction}>
                <input type="hidden" name="roleId" value={r.id} />
                {groups.map((g) => (
                  <fieldset key={g} className="mb-3">
                    <legend className="type-eyebrow mb-1">{t(g)}</legend>
                    {Object.entries(PERMISSIONS).filter(([, p]) => p.group === g).map(([k, p]) => (
                      <label key={k} className="flex items-start gap-2 py-0.5 text-[0.8125rem]"><input type="checkbox" name="permissions" value={k} defaultChecked={has.has(k)} className="mt-0.5 h-4 w-4 accent-[rgb(22,38,68)]" /><span><span className="font-mono text-[0.75rem] text-ink-muted">{k}</span> — {t(p.description)}</span></label>
                    ))}
                  </fieldset>
                ))}
                <SubmitButton size="sm">{t("Save {name}", { name: r.name })}</SubmitButton>
              </ActionForm>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
