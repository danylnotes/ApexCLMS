import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { EmptyState, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Certificates and Credentials") };
}

export default async function CertificatesPage() {
  const { t } = await getI18n();
  const actor = await requireActor();
  const now = new Date();
  const [certs, creds] = await Promise.all([
    prisma.certificate.findMany({ where: { userId: actor.id }, orderBy: { issuedAt: "desc" }, include: { course: { select: { title: true, slug: true, code: true } }, completion: { select: { finalPercent: true } } } }),
    prisma.credential.findMany({ where: { userId: actor.id }, orderBy: { issuedOn: "desc" }, include: { verifiedBy: { select: { name: true } } } }),
  ]);
  const state = (c: (typeof certs)[number]) => {
    if (c.status === "REVOKED") return <Status tone="crit">{t("Revoked")}</Status>;
    if (c.expiresAt && c.expiresAt < now) return <Status tone="crit">{t("Expired")}</Status>;
    if (c.expiresAt && c.expiresAt.getTime() - now.getTime() < 60 * 86_400_000) return <Status tone="warn">{t("Expires soon")}</Status>;
    return <Status tone="ok">{t("Valid")}</Status>;
  };
  return (
    <div>
      <PageHeader eyebrow={t("Development")} title={t("Certificates and Credentials")} description={t("Certificates are issued automatically when a course's completion rules are met. Each has a unique serial number for verification.")} />
      <Panel title={t("Course certificates")} bodyClassName="pt-0">
        {certs.length === 0 ? <div className="pt-4"><EmptyState title={t("No certificates yet")}>{t("Complete a course to receive its certificate.")}</EmptyState></div> : (
          <Table caption={t("Course certificates")}>
            <thead><tr><Th>{t("Course")}</Th><Th>{t("Serial")}</Th><Th>{t("Issued")}</Th><Th>{t("Expires")}</Th><Th>{t("Score")}</Th><Th>{t("Status")}</Th><Th /></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <Td><Link href={`/courses/${c.course.slug}`} className="font-medium">{c.course.title}</Link><div className="type-meta">{c.course.code}</div></Td>
                  <Td className="font-mono text-[0.75rem]">{c.serial}</Td>
                  <Td>{fmtDate(c.issuedAt)}</Td>
                  <Td>{c.expiresAt ? fmtDate(c.expiresAt) : t("No expiry")}</Td>
                  <Td>{c.completion.finalPercent != null ? t("{percent}%", { percent: c.completion.finalPercent }) : "—"}</Td>
                  <Td>{state(c)}</Td>
                  <Td align="right">{c.status === "VALID" && <a href={`/api/v1/certificates/${c.id}/pdf`} className="font-sans text-sm">{t("Download PDF")}</a>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel title={t("Professional credentials")} description={t("External qualifications recorded on your profile. Verified credentials have been checked by L&D or HR.")} className="mt-8" bodyClassName="pt-0">
        {creds.length === 0 ? <p className="pt-4 type-meta">{t("No external credentials recorded. Ask L&D to record and verify professional qualifications.")}</p> : (
          <Table caption={t("Professional credentials")}>
            <thead><tr><Th>{t("Credential")}</Th><Th>{t("Issuer")}</Th><Th>{t("Issued")}</Th><Th>{t("Expires")}</Th><Th>{t("Verification")}</Th></tr></thead>
            <tbody>{creds.map((c) => <tr key={c.id}><Td className="font-medium">{c.name}</Td><Td>{c.issuer}</Td><Td>{fmtDate(c.issuedOn)}</Td><Td>{fmtDate(c.expiresOn)}</Td><Td>{c.verifiedAt ? <Status tone="ok">{t("Verified by {name}", { name: c.verifiedBy?.name })}</Status> : <Status tone="idle">{t("Unverified")}</Status>}</Td></tr>)}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
