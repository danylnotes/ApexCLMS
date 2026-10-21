import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { createUserAction, updateUserAction } from "../../staff-actions";

type Existing = Awaited<ReturnType<typeof loadUser>>;
export async function loadUser(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { profile: true, roles: { include: { role: true } }, managedBy: { where: { type: "LINE", endDate: null } } } });
}

export async function UserForm({ u }: { u?: NonNullable<Existing> }) {
  const { t } = await getI18n();
  const [departments, jobRoles, units, policies, roles, managers] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ orderBy: { title: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.cpdPolicy.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { status: "ACTIVE", ...(u ? { id: { not: u.id } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const p = u?.profile;
  const sel = (name: string, label: string, opts: { id: string; label: string }[], value?: string | null) => (
    <Field label={label} htmlFor={`u-${name}`}><select id={`u-${name}`} name={name} defaultValue={value ?? ""} className="input-base"><option value="">—</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
  );
  const roleKeys = u?.roles.map((r) => r.role.key) ?? ["EMPLOYEE"];
  return (
    <ActionForm action={u ? updateUserAction : createUserAction} className="grid gap-4 md:grid-cols-3">
      {u && <input type="hidden" name="userId" value={u.id} />}
      <Field label={t("Full name")} htmlFor="u-name" required><input id="u-name" name="name" defaultValue={u?.name} required className="input-base" /></Field>
      <Field label={t("Email")} htmlFor="u-email" required><input id="u-email" name="email" type="email" defaultValue={u?.email} required className="input-base" /></Field>
      <Field label={t("Staff ID")} htmlFor="u-emp" required hint={t("Used to sign in; resolves job title and content access.")}><input id="u-emp" name="employeeNumber" defaultValue={p?.employeeNumber ?? ""} required className="input-base uppercase" placeholder={t("e.g. {example}", { example: "D-20101" })} /></Field>
      {sel("departmentId", t("Department"), departments.map((d) => ({ id: d.id, label: d.name })), p?.departmentId)}
      {sel("businessUnitId", t("Business unit"), units.map((d) => ({ id: d.id, label: d.name })), p?.businessUnitId)}
      <Field label={t("Location")} htmlFor="u-loc"><input id="u-loc" name="location" defaultValue={p?.location ?? ""} className="input-base" /></Field>
      {sel("jobRoleId", t("Job role"), jobRoles.map((d) => ({ id: d.id, label: d.title })), p?.jobRoleId)}
      {sel("targetJobRoleId", t("Target role"), jobRoles.map((d) => ({ id: d.id, label: d.title })), p?.targetJobRoleId)}
      {sel("managerId", t("Line manager"), managers.map((m) => ({ id: m.id, label: m.name })), u?.managedBy[0]?.managerId)}
      {sel("cpdPolicyId", t("CPD policy"), policies.map((d) => ({ id: d.id, label: d.name })), p?.cpdPolicyId)}
      <Field label={t("Employment status")} htmlFor="u-es"><select id="u-es" name="employmentStatus" defaultValue={p?.employmentStatus ?? "PERMANENT"} className="input-base"><option value="PERMANENT">{t("Permanent")}</option><option value="CONTRACT">{t("Contract")}</option><option value="ON_LEAVE">{t("On leave")}</option><option value="SECONDED">{t("Seconded")}</option></select></Field>
      <Field label={t("Learning programme")} htmlFor="u-lp"><input id="u-lp" name="learningProgramme" defaultValue={p?.learningProgramme ?? ""} className="input-base" /></Field>
      <fieldset className="md:col-span-3"><legend className="font-sans text-[0.8125rem] font-medium">{t("Platform roles")}</legend><div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">{roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-[0.875rem]"><input type="checkbox" name="roleKeys" value={r.key} defaultChecked={roleKeys.includes(r.key)} className="h-4 w-4 accent-[rgb(22,38,68)]" />{r.name}</label>)}</div></fieldset>
      {!u && <label className="flex items-center gap-2 font-sans text-sm md:col-span-3"><input type="checkbox" name="invite" defaultChecked className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Send an invitation email now (7-day activation link)")}</label>}
      <div><SubmitButton>{u ? t("Save changes") : t("Create user")}</SubmitButton></div>
    </ActionForm>
  );
}
