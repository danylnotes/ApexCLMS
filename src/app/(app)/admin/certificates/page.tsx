import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, PageHeader, Pagination, Panel, Status, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { certificateAdminAction } from "../../staff-actions";

export const metadata = { title: "Certificate Management" };

export default async function CertificatesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePagePermission("certificate.manage");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = sp.q ? { OR: [{ serial: { contains: sp.q, mode: "insensitive" as const } }, { user: { name: { contains: sp.q, mode: "insensitive" as const } } }] } : {};
  const [templates, total, certs] = await Promise.all([prisma.certificateTemplate.findMany({ orderBy: { createdAt: "asc" } }), prisma.certificate.count({ where }), prisma.certificate.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (page - 1) * 25, take: 25, include: { user: { select: { name: true } }, course: { select: { code: true, title: true } } } })]);
  const now = new Date();
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Certificate Management" description="Certificates are issued automatically when completion rules are met. Revocation is permanent, recorded and notified to the holder." />
      <div className="grid gap-6 lg:grid-cols-2">
        {[...templates, null].map((t) => (
          <Panel key={t?.id ?? "new"} title={t ? `${t.name}${t.isDefault ? " (default)" : ""}` : "New template"}>
            <ActionForm action={certificateAdminAction} className="grid gap-3 sm:grid-cols-2">
              {t && <input type="hidden" name="templateId" value={t.id} />}
              <Field label="Template name" htmlFor={`tn-${t?.id ?? "n"}`}><input id={`tn-${t?.id ?? "n"}`} name="name" defaultValue={t?.name} required className="input-base" /></Field>
              <Field label="Heading" htmlFor={`th-${t?.id ?? "n"}`}><input id={`th-${t?.id ?? "n"}`} name="heading" defaultValue={t?.heading ?? "Certificate of Completion"} className="input-base" /></Field>
              <div className="sm:col-span-2"><Field label="Body text" htmlFor={`tb-${t?.id ?? "n"}`}><input id={`tb-${t?.id ?? "n"}`} name="bodyText" defaultValue={t?.bodyText ?? "has successfully completed all requirements of"} className="input-base" /></Field></div>
              <Field label="Signatory" htmlFor={`ts-${t?.id ?? "n"}`}><input id={`ts-${t?.id ?? "n"}`} name="signatoryName" defaultValue={t?.signatoryName} required className="input-base" /></Field>
              <Field label="Signatory title" htmlFor={`tt-${t?.id ?? "n"}`}><input id={`tt-${t?.id ?? "n"}`} name="signatoryTitle" defaultValue={t?.signatoryTitle} className="input-base" /></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="isDefault" defaultChecked={t?.isDefault} className="h-4 w-4 accent-[rgb(22,38,68)]" />Default for new certificates</label>
              <div><SubmitButton size="sm">Save template</SubmitButton></div>
            </ActionForm>
          </Panel>
        ))}
      </div>
      <Panel title="Issued certificates" className="mt-8" description={`${total} certificates`} bodyClassName="pt-0">
        <form className="my-3 flex gap-2" action="/admin/certificates"><label htmlFor="cq" className="sr-only">Search</label><input id="cq" name="q" defaultValue={sp.q} placeholder="Serial or holder" className="input-base h-9 max-w-xs" /><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Search</button></form>
        <Table caption="Issued certificates"><thead><tr><Th>Serial</Th><Th>Holder</Th><Th>Course</Th><Th>Issued</Th><Th>Expires</Th><Th>Status</Th><Th>Revoke</Th></tr></thead>
          <tbody>{certs.map((c) => <tr key={c.id}><Td className="font-mono text-[0.75rem]"><a href={`/api/v1/certificates/${c.id}/pdf`}>{c.serial}</a></Td><Td>{c.user.name}</Td><Td>{c.course.code}</Td><Td>{fmtDate(c.issuedAt)}</Td><Td>{fmtDate(c.expiresAt)}</Td><Td>{c.status === "REVOKED" ? <Status tone="crit">Revoked</Status> : c.expiresAt && c.expiresAt < now ? <Status tone="warn">Expired</Status> : <Status tone="ok">Valid</Status>}</Td><Td>{c.status === "VALID" && <ActionForm action={certificateAdminAction} className="flex gap-1"><input type="hidden" name="op" value="revoke" /><input type="hidden" name="certificateId" value={c.id} /><input name="reason" placeholder="Reason" aria-label="Revocation reason" required className="input-base h-8 w-32" /><SubmitButton size="sm" variant="danger" confirm="Revoke this certificate permanently?">Revoke</SubmitButton></ActionForm>}</Td></tr>)}</tbody>
        </Table>
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/admin/certificates?page=${p}${sp.q ? `&q=${sp.q}` : ""}`} />
      </Panel>
      <p className="mt-4 type-meta"><Link href="/admin/reports">Organisation reports</Link></p>
    </div>
  );
}
