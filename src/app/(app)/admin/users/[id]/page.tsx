import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, Notice, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { contentAccessAction, orgDataAction, userStatusAction } from "../../../staff-actions";
import { accessSummary } from "@/server/services/access";
import { loadUser, UserForm } from "../user-form";

export const metadata = { title: "Edit user" };

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requirePagePermission("user.manage");
  const { id } = await params;
  const { created } = await searchParams;
  const u = await loadUser(id);
  if (!u) notFound();
  const [credentials, sessions, access, jobRoles] = await Promise.all([prisma.credential.findMany({ where: { userId: id }, orderBy: { issuedOn: "desc" } }), prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }), accessSummary(id), prisma.jobRole.findMany({ where: { isActive: true }, orderBy: [{ grade: "asc" }, { title: "asc" }] })]);
  const grantable = jobRoles.filter((r) => !access.grants.some((g) => g.jobRoleId === r.id));
  const op = (o: string, label: string, variant: "secondary" | "danger" = "secondary", confirm?: string) => <ActionForm action={userStatusAction} inline><input type="hidden" name="userId" value={id} /><input type="hidden" name="op" value={o} /><SubmitButton variant={variant} confirm={confirm}>{label}</SubmitButton></ActionForm>;
  return (
    <div>
      <PageHeader crumbs={[{ label: "Users", href: "/admin/users" }, { label: u.name }]} eyebrow="Administration" title={u.name} meta={<><Status tone={u.status === "ACTIVE" ? "ok" : u.status === "INVITED" ? "info" : "idle"}>{u.status.toLowerCase()}</Status><span>{u.email}</span><span>{sessions} active session{sessions === 1 ? "" : "s"}</span><span>Last sign-in {fmtDate(u.lastLoginAt)}</span></>}
        actions={id !== actor.id && <>{u.status === "INVITED" && op("invite", "Resend invitation")}{u.status === "ACTIVE" && op("deactivate", "Deactivate", "danger", "Deactivate this user and end all sessions?")}{u.status === "DEACTIVATED" && op("activate", "Reactivate")}<LinkButton href={`/manager/team/${id}`} variant="ghost">Development record</LinkButton></>} />
      {created && <div className="mb-6"><Notice tone="ok">User created{u.status === "INVITED" ? " — an invitation has been recorded in the email outbox" : ""}.</Notice></div>}
      <Panel title="Profile and access"><UserForm u={u} /></Panel>
      <Panel id="access" title="Content access by job title" className="mt-8" description={`Staff ID ${access.staffId ?? "—"} resolves to ${access.jobRole?.title ?? "no job title"}. Course and learning-path content is visible only for the job titles granted here; a promotion does not open the next level until you grant it.`} bodyClassName="pt-0">
        {access.allContent && <div className="mb-3"><Notice tone="info">This user manages learning content and can see all courses regardless of job title.</Notice></div>}
        {access.pendingCurrentRole && <div className="mb-3"><Notice tone="warn">Job title is {access.jobRole!.title}, but content for that level has not been granted yet.</Notice></div>}
        <Table caption="Granted access levels"><thead><tr><Th>Job title</Th><Th>Grade</Th><Th>Granted</Th><Th>By</Th><Th>Reason</Th><Th><span className="sr-only">Actions</span></Th></tr></thead><tbody>
          {access.grants.map((g) => <tr key={g.id}><Td>{g.jobRole.title}{g.jobRoleId === access.jobRole?.id && <span className="ml-2"><Status tone="ok">current</Status></span>}</Td><Td>{g.jobRole.grade ?? "—"}</Td><Td>{fmtDate(g.grantedAt)}</Td><Td>{g.grantedBy?.name ?? "System"}</Td><Td>{g.reason ?? "—"}</Td><Td>{id !== actor.id && <ActionForm action={contentAccessAction} inline><input type="hidden" name="op" value="revoke" /><input type="hidden" name="grantId" value={g.id} /><SubmitButton size="sm" variant="ghost" confirm={`Remove access to ${g.jobRole.title} content?`}>Remove</SubmitButton></ActionForm>}</Td></tr>)}
          {!access.grants.length && <tr><Td colSpan={6}>No access granted. Only content open to all job titles is visible.</Td></tr>}
        </tbody></Table>
        {grantable.length > 0 && (
          <ActionForm action={contentAccessAction} className="mt-4 grid gap-3 md:grid-cols-6" resetOnSuccess>
            <input type="hidden" name="op" value="grant" /><input type="hidden" name="userId" value={id} />
            <div className="md:col-span-2"><Field label="Grant access to job title" htmlFor="ga-role"><select id="ga-role" name="jobRoleId" required className="input-base" defaultValue={access.pendingCurrentRole ? access.jobRole!.id : ""}><option value="" disabled>Choose…</option>{grantable.map((r) => <option key={r.id} value={r.id}>{r.title}{r.grade ? ` (grade ${r.grade})` : ""}</option>)}</select></Field></div>
            <div className="md:col-span-3"><Field label="Reason" htmlFor="ga-reason"><input id="ga-reason" name="reason" className="input-base" placeholder="e.g. Promoted to Senior Operator, effective 1 Nov" /></Field></div>
            <div className="flex items-end"><SubmitButton size="sm">Grant access</SubmitButton></div>
          </ActionForm>
        )}
      </Panel>
      <Panel title="Professional credentials" className="mt-8" bodyClassName="pt-0">
        <Table caption="Credentials"><thead><tr><Th>Credential</Th><Th>Issuer</Th><Th>Issued</Th><Th>Expires</Th><Th>Verified</Th></tr></thead><tbody>{credentials.map((c) => <tr key={c.id}><Td>{c.name}</Td><Td>{c.issuer}</Td><Td>{fmtDate(c.issuedOn)}</Td><Td>{fmtDate(c.expiresOn)}</Td><Td>{c.verifiedAt ? fmtDate(c.verifiedAt) : "No"}</Td></tr>)}</tbody></Table>
        <ActionForm action={orgDataAction} className="mt-4 grid gap-3 md:grid-cols-6" resetOnSuccess>
          <input type="hidden" name="op" value="credential" /><input type="hidden" name="userId" value={id} />
          <div className="md:col-span-2"><Field label="Credential" htmlFor="cn"><input id="cn" name="name" required className="input-base" /></Field></div>
          <Field label="Issuer" htmlFor="ci"><input id="ci" name="issuer" required className="input-base" /></Field>
          <Field label="Number" htmlFor="cno"><input id="cno" name="credentialNo" className="input-base" /></Field>
          <Field label="Issued" htmlFor="cis"><input id="cis" name="issuedOn" type="date" required className="input-base" /></Field>
          <Field label="Expires" htmlFor="cex"><input id="cex" name="expiresOn" type="date" className="input-base" /></Field>
          <label className="flex items-center gap-2 font-sans text-sm md:col-span-3"><input type="checkbox" name="verify" className="h-4 w-4 accent-[rgb(22,38,68)]" />I have verified this credential against the original</label>
          <div><SubmitButton size="sm">Add credential</SubmitButton></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
