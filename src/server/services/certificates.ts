import { safeStandardFont } from "../pdf-text";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../auth/session";
import { can, canViewEmployee } from "../policy";
import { loadSettingsUncached } from "../settings";

const NAVY = rgb(0.086, 0.149, 0.267);
const COPPER = rgb(0.651, 0.384, 0.204);
const GREY = rgb(0.35, 0.38, 0.42);

export async function certificateFor(actor: Actor, id: string) {
  const c = await prisma.certificate.findUnique({ where: { id }, include: { user: { select: { name: true } }, course: true, completion: true, template: true } });
  if (!c) throw notFound("Certificate");
  if (c.userId !== actor.id && !can(actor, "certificate.manage") && !(await canViewEmployee(actor, c.userId))) throw notFound("Certificate");
  return c;
}

/** Renders a certificate from verified completion records. */
export async function renderCertificatePdf(actor: Actor, id: string) {
  const c = await certificateFor(actor, id);
  const { branding } = await loadSettingsUncached();
  const t = c.template ?? (await prisma.certificateTemplate.findFirst({ where: { isDefault: true } }));
  const doc = await PDFDocument.create();
  doc.setTitle(`${t?.heading ?? "Certificate"} — ${c.course.title}`);
  doc.setAuthor(branding.organisationName);
  const page = doc.addPage([842, 595]);
  const serif = safeStandardFont(await doc.embedFont(StandardFonts.TimesRoman));
  const serifBold = safeStandardFont(await doc.embedFont(StandardFonts.TimesRomanBold));
  const sans = safeStandardFont(await doc.embedFont(StandardFonts.Helvetica));
  const sansBold = safeStandardFont(await doc.embedFont(StandardFonts.HelveticaBold));
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: NAVY, borderWidth: 1.5 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: COPPER, borderWidth: 0.5 });
  const center = (text: string, y: number, font: typeof sans, size: number, color = NAVY) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };
  const fit = (text: string, font: typeof sans, max: number, start: number) => {
    let s = start;
    while (font.widthOfTextAtSize(text, s) > max && s > 10) s -= 1;
    return s;
  };
  center(branding.organisationName.toUpperCase(), 520, sansBold, 10, GREY);
  center(branding.productName, 504, sans, 9, GREY);
  center(t?.heading ?? "Certificate of Completion", 440, serifBold, 34);
  center("This is to certify that", 395, serif, 13, GREY);
  center(c.user.name, 355, serifBold, fit(c.user.name, serifBold, 640, 30));
  center(t?.bodyText ?? "has successfully completed all requirements of", 318, serif, 13, GREY);
  center(c.course.title, 282, serifBold, fit(c.course.title, serifBold, 680, 22));
  center(`${c.course.code} · ${Number(c.course.estimatedHours)} hours estimated study${c.completion.finalPercent != null ? ` · final assessment ${c.completion.finalPercent}%` : ""}`, 256, sans, 10, GREY);
  const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  page.drawLine({ start: { x: 120, y: 150 }, end: { x: 330, y: 150 }, thickness: 0.5, color: GREY });
  page.drawText(t?.signatoryName ?? "Learning & Development", { x: 120, y: 134, size: 11, font: sansBold, color: NAVY });
  page.drawText(t?.signatoryTitle ?? "", { x: 120, y: 120, size: 9, font: sans, color: GREY });
  page.drawText(`Issued ${date(c.issuedAt)}`, { x: 520, y: 152, size: 11, font: sansBold, color: NAVY });
  page.drawText(c.expiresAt ? `Valid until ${date(c.expiresAt)}` : "No expiry", { x: 520, y: 138, size: 9, font: sans, color: GREY });
  page.drawText(`Serial ${c.serial}`, { x: 520, y: 124, size: 9, font: sans, color: GREY });
  if (c.status === "REVOKED") center(`REVOKED ${c.revokedAt ? date(c.revokedAt) : ""}`, 200, sansBold, 28, rgb(0.67, 0.15, 0.15));
  center("Internal certificate of course completion. It does not by itself imply external accreditation or workplace competence.", 62, sans, 7.5, GREY);
  return { bytes: await doc.save(), filename: `certificate-${c.serial}.pdf` };
}
