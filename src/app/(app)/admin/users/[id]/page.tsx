import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, Notice, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { contentAccessAction, orgDataAction, userStatusAction } from "../../../staff-actions";
import { accessSummary } from "@/server/services/access";
import { getI18n } from "@/i18n/server";
import { loadUser, UserForm } from "../user-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Edit user") };
}

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requirePagePermission("user.manage");
  const { t } = await getI18n();
  const statusLabel: Record<string, string> = { ACTIVE: t("active"), INVITED: t("invited"), DEACTIVATED: t("deactivated") };
  const { id } = await params;
  const { created } = await searchParams;
  const u = await loadUser(id);
  if (!u) notFound();
  const [credentials, sessions, access, jobRoles] = await Promise.all([prisma.credential.findMany({ where: { userId: id }, orderBy: { issuedOn: "desc" } }), prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }), accessSummary(id), prisma.jobRole.findMany({ where: { isActive: true }, orderBy: [{ grade: "asc" }, { title: "asc" }] })]);
  const grantable = jobRoles.filter((r) => !access.grants.some((g) => g.jobRoleId === r.id));
  const op = (o: string, label: string, variant: "secondary" | "danger" = "secondary", confirm?: string) => <ActionForm action={userStatusAction} inline><input type="hidden" name="userId" value={id} /><input type="hidden" name="op" value={o} /><SubmitButton variant={variant} confirm={confirm}>{label}</SubmitButton></ActionForm>;
  return (
    <div>
      <PageHeader crumbs={[{ label: t("Users"), href: "/admin/users" }, { label: u.name }]} eyebrow={t("Administration")} title={u.name} meta={<><Status tone={u.status === "ACTIVE" ? "ok" : u.status === "INVITED" ? "info" : "idle"}>{statusLabel[u.status] ?? u.status.toLowerCase()}</Status><span>{u.email}</span><span>{t("{count, plural, one {# active session} other {# active sessions}}", { count: sessions })}</span><span>{t("Last sign-in {date}", { date: fmtDate(u.lastLoginAt) })}</span></>}
        actions={id !== actor.id && <>{u.status === "INVITED" && op("invite", t("Resend invitation"))}{u.status === "ACTIVE" && op("deactivate", t("Deactivate"), "danger", t("Deactivate this user and end all sessions?"))}{u.status === "DEACTIVATED" && op("activate", t("Reactivate"))}<LinkButton href={`/manager/team/${id}`} variant="ghost">{t("Development record")}</LinkButton></>} />
      {created && <div className="mb-6"><Notice tone="ok">{u.status === "INVITED" ? t("User created — an invitation has been recorded in the email outbox.") : t("User created.")}</Notice></div>}
      <Panel title={t("Profile and access")}><UserForm u={u} /></Panel>
      <Panel id="access" title={t("Content access by job title")} className="mt-8" description={t("Staff ID {staffId} resolves to {jobTitle}. Course and learning-path content is visible only for the job titles granted here; a promotion does not open the next level until you grant it.", { staffId: access.staffId ?? "—", jobTitle: access.jobRole?.title ?? t("no job title") })} bodyClassName="pt-0">
        {access.allContent && <div className="mb-3"><Notice tone="info">{t("This user manages learning content and can see all courses regardless of job title.")}</Notice></div>}
        {access.pendingCurrentRole && <div className="mb-3"><Notice tone="warn">{t("Job title is {jobTitle}, but content for that level has not been granted yet.", { jobTitle: access.jobRole!.title })}</Notice></div>}
        <Table caption={t("Granted access levels")}><thead><tr><Th>{t("Job title")}</Th><Th>{t("Grade")}</Th><Th>{t("Granted")}</Th><Th>{t("By")}</Th><Th>{t("Reason")}</Th><Th><span className="sr-only">{t("Actions")}</span></Th></tr></thead><tbody>
          {access.grants.map((g) => <tr key={g.id}><Td>{g.jobRole.title}{g.jobRoleId === access.jobRole?.id && <span className="ms-2"><Status tone="ok">{t("current")}</Status></span>}</Td><Td>{g.jobRole.grade ?? "—"}</Td><Td>{fmtDate(g.grantedAt)}</Td><Td>{g.grantedBy?.name ?? t("System")}</Td><Td>{g.reason ?? "—"}</Td><Td>{id !== actor.id && <ActionForm action={contentAccessAction} inline><input type="hidden" name="op" value="revoke" /><input type="hidden" name="grantId" value={g.id} /><SubmitButton size="sm" variant="ghost" confirm={t("Remove access to {jobTitle} content?", { jobTitle: g.jobRole.title })}>{t("Remove")}</SubmitButton></ActionForm>}</Td></tr>)}
          {!access.grants.length && <tr><Td colSpan={6}>{t("No access granted. Only content open to all job titles is visible.")}</Td></tr>}
        </tbody></Table>
        {grantable.length > 0 && (
          <ActionForm action={contentAccessAction} className="mt-4 grid gap-3 md:grid-cols-6" resetOnSuccess>
            <input type="hidden" name="op" value="grant" /><input type="hidden" name="userId" value={id} />
            <div className="md:col-span-2"><Field label={t("Grant access to job title")} htmlFor="ga-role"><select id="ga-role" name="jobRoleId" required className="input-base" defaultValue={access.pendingCurrentRole ? access.jobRole!.id : ""}><option value="" disabled>{t("Choose…")}</option>{grantable.map((r) => <option key={r.id} value={r.id}>{r.grade ? t("{title} (grade {grade})", { title: r.title, grade: r.grade }) : r.title}</option>)}</select></Field></div>
            <div className="md:col-span-3"><Field label={t("Reason")} htmlFor="ga-reason"><input id="ga-reason" name="reason" className="input-base" placeholder={t("e.g. Promoted to Senior Operator, effective 1 Nov")} /></Field></div>
            <div className="flex items-end"><SubmitButton size="sm">{t("Grant access")}</SubmitButton></div>
          </ActionForm>
        )}
      </Panel>
      <Panel title={t("Professional credentials")} className="mt-8" bodyClassName="pt-0">
        <Table caption={t("Credentials")}><thead><tr><Th>{t("Credential")}</Th><Th>{t("Issuer")}</Th><Th>{t("Issued")}</Th><Th>{t("Expires")}</Th><Th>{t("Verified")}</Th></tr></thead><tbody>{credentials.map((c) => <tr key={c.id}><Td>{c.name}</Td><Td>{c.issuer}</Td><Td>{fmtDate(c.issuedOn)}</Td><Td>{fmtDate(c.expiresOn)}</Td><Td>{c.verifiedAt ? fmtDate(c.verifiedAt) : t("No")}</Td></tr>)}</tbody></Table>
        <ActionForm action={orgDataAction} className="mt-4 grid gap-3 md:grid-cols-6" resetOnSuccess>
          <input type="hidden" name="op" value="credential" /><input type="hidden" name="userId" value={id} />
          <div className="md:col-span-2"><Field label={t("Credential")} htmlFor="cn"><input id="cn" name="name" required className="input-base" /></Field></div>
          <Field label={t("Issuer")} htmlFor="ci"><input id="ci" name="issuer" required className="input-base" /></Field>
          <Field label={t("Number")} htmlFor="cno"><input id="cno" name="credentialNo" className="input-base" /></Field>
          <Field label={t("Issued")} htmlFor="cis"><input id="cis" name="issuedOn" type="date" required className="input-base" /></Field>
          <Field label={t("Expires")} htmlFor="cex"><input id="cex" name="expiresOn" type="date" className="input-base" /></Field>
          <label className="flex items-center gap-2 font-sans text-sm md:col-span-3"><input type="checkbox" name="verify" className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("I have verified this credential against the original")}</label>
          <div><SubmitButton size="sm">{t("Add credential")}</SubmitButton></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
