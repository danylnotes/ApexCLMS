import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, PageHeader, Pagination, Panel, Status, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { certificateAdminAction } from "../../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Certificate Management") };
}

export default async function CertificatesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePagePermission("certificate.manage");
  const sp = await searchParams;
  const { t } = await getI18n();
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = sp.q ? { OR: [{ serial: { contains: sp.q, mode: "insensitive" as const } }, { user: { name: { contains: sp.q, mode: "insensitive" as const } } }] } : {};
  const [templates, total, certs] = await Promise.all([prisma.certificateTemplate.findMany({ orderBy: { createdAt: "asc" } }), prisma.certificate.count({ where }), prisma.certificate.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (page - 1) * 25, take: 25, include: { user: { select: { name: true } }, course: { select: { code: true, title: true } } } })]);
  const now = new Date();
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Certificate Management")} description={t("Certificates are issued automatically when completion rules are met. Revocation is permanent, recorded and notified to the holder.")} />
      <div className="grid gap-6 lg:grid-cols-2">
        {[...templates, null].map((tpl) => (
          <Panel key={tpl?.id ?? "new"} title={tpl ? (tpl.isDefault ? t("{name} (default)", { name: tpl.name }) : tpl.name) : t("New template")}>
            <ActionForm action={certificateAdminAction} className="grid gap-3 sm:grid-cols-2">
              {tpl && <input type="hidden" name="templateId" value={tpl.id} />}
              <Field label={t("Template name")} htmlFor={`tn-${tpl?.id ?? "n"}`}><input id={`tn-${tpl?.id ?? "n"}`} name="name" defaultValue={tpl?.name} required className="input-base" /></Field>
              <Field label={t("Heading")} htmlFor={`th-${tpl?.id ?? "n"}`}><input id={`th-${tpl?.id ?? "n"}`} name="heading" defaultValue={tpl?.heading ?? "Certificate of Completion"} className="input-base" /></Field>
              <div className="sm:col-span-2"><Field label={t("Body text")} htmlFor={`tb-${tpl?.id ?? "n"}`}><input id={`tb-${tpl?.id ?? "n"}`} name="bodyText" defaultValue={tpl?.bodyText ?? "has successfully completed all requirements of"} className="input-base" /></Field></div>
              <Field label={t("Signatory")} htmlFor={`ts-${tpl?.id ?? "n"}`}><input id={`ts-${tpl?.id ?? "n"}`} name="signatoryName" defaultValue={tpl?.signatoryName} required className="input-base" /></Field>
              <Field label={t("Signatory title")} htmlFor={`tt-${tpl?.id ?? "n"}`}><input id={`tt-${tpl?.id ?? "n"}`} name="signatoryTitle" defaultValue={tpl?.signatoryTitle} className="input-base" /></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="isDefault" defaultChecked={tpl?.isDefault} className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Default for new certificates")}</label>
              <div><SubmitButton size="sm">{t("Save template")}</SubmitButton></div>
            </ActionForm>
          </Panel>
        ))}
      </div>
      <Panel title={t("Issued certificates")} className="mt-8" description={t("{count, plural, one {# certificate} other {# certificates}}", { count: total })} bodyClassName="pt-0">
        <form className="my-3 flex gap-2" action="/admin/certificates"><label htmlFor="cq" className="sr-only">{t("Search")}</label><input id="cq" name="q" defaultValue={sp.q} placeholder={t("Serial or holder")} className="input-base h-9 max-w-xs" /><button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">{t("Search")}</button></form>
        <Table caption={t("Issued certificates")}><thead><tr><Th>{t("Serial")}</Th><Th>{t("Holder")}</Th><Th>{t("Course")}</Th><Th>{t("Issued")}</Th><Th>{t("Expires")}</Th><Th>{t("Status")}</Th><Th>{t("Revoke")}</Th></tr></thead>
          <tbody>{certs.map((c) => <tr key={c.id}><Td className="font-mono text-[0.75rem]"><a href={`/api/v1/certificates/${c.id}/pdf`}>{c.serial}</a></Td><Td>{c.user.name}</Td><Td>{c.course.code}</Td><Td>{fmtDate(c.issuedAt)}</Td><Td>{fmtDate(c.expiresAt)}</Td><Td>{c.status === "REVOKED" ? <Status tone="crit">{t("Revoked")}</Status> : c.expiresAt && c.expiresAt < now ? <Status tone="warn">{t("Expired")}</Status> : <Status tone="ok">{t("Valid")}</Status>}</Td><Td>{c.status === "VALID" && <ActionForm action={certificateAdminAction} className="flex gap-1"><input type="hidden" name="op" value="revoke" /><input type="hidden" name="certificateId" value={c.id} /><input name="reason" placeholder={t("Reason")} aria-label={t("Revocation reason")} required className="input-base h-8 w-32" /><SubmitButton size="sm" variant="danger" confirm={t("Revoke this certificate permanently?")}>{t("Revoke")}</SubmitButton></ActionForm>}</Td></tr>)}</tbody>
        </Table>
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/admin/certificates?page=${p}${sp.q ? `&q=${sp.q}` : ""}`} />
      </Panel>
      <p className="mt-4 type-meta"><Link href="/admin/reports">{t("Organisation reports")}</Link></p>
    </div>
  );
}
