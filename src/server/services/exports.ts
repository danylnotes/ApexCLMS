import { safeStandardFont } from "../pdf-text";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../db";
import { forbidden, invalid } from "../errors";
import type { Actor } from "../auth/session";
import { can, reportingScope } from "../policy";
import { audit } from "../audit";
import { loadSettingsUncached } from "../settings";
import { cpdWorkspace, CPD_TYPE_LABEL } from "./cpd";
import { buildProfile, METHOD_LABEL } from "./competency";
import { mandatoryState } from "@/lib/domain/compliance";

type Row = (string | number | null | undefined | Date)[];
const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "");

/** Self-service exports: only ever the caller's own records. */
export async function selfExport(actor: Actor, type: string, periodId?: string): Promise<{ filename: string; rows: Row[] }> {
  const uid = actor.id;
  switch (type) {
    case "history": {
      const ev = await prisma.learningActivityEvent.findMany({ where: { userId: uid }, orderBy: { occurredAt: "desc" } });
      return { filename: "learning-history.csv", rows: [["Date", "Activity", "Details"], ...ev.map((e) => [d(e.occurredAt), e.type, e.summary])] };
    }
    case "completions": {
      const c = await prisma.courseCompletion.findMany({ where: { userId: uid }, orderBy: { completedAt: "desc" }, include: { course: true, certificate: true, enrollment: true } });
      return { filename: "course-completions.csv", rows: [["Course code", "Course", "Completed", "Final score %", "Certificate serial", "Certificate expires", "Recorded learning minutes"], ...c.map((x) => [x.course.code, x.course.title, d(x.completedAt), x.finalPercent, x.certificate?.serial, d(x.certificate?.expiresAt), Math.round(x.enrollment.timeSpentSeconds / 60)])] };
    }
    case "cpd": {
      const ws = await cpdWorkspace(uid, periodId || undefined);
      return {
        filename: `cpd-record-${ws.period?.name ?? "all"}.csv`,
        rows: [["Activity", "Type", "Provider", "Date", "Duration (h)", "Unit", "Claimed", "Approved", "Status", "Recognition", "Source"], ...ws.claims.map((c) => [c.activity.title, CPD_TYPE_LABEL[c.activity.type], c.activity.provider, d(c.activity.activityDate), Number(c.activity.durationHours), c.unit, Number(c.claimedValue), c.approvedValue == null ? "" : Number(c.approvedValue), c.status, c.recognition, c.activity.courseCompletionId ? "Course completion" : c.activity.webinarAttendanceId ? "Verified webinar" : "Employee submission"])],
      };
    }
    case "competency": {
      const p = await prisma.userProfile.findUnique({ where: { userId: uid } });
      const prof = await buildProfile(uid, p?.jobRoleId ?? null);
      return { filename: "competency-record.csv", rows: [["Code", "Competency", "Domain", "Required level", "Recorded level", "Effective level", "Status", "Method", "Evidence basis", "Assessed", "Assessor", "Reassessment due"], ...prof.rows.map((r) => [r.competency.code, r.competency.name, r.competency.domain, r.requiredLevel, r.current?.level, r.evaluation?.effectiveLevel, r.evaluation?.status, r.current ? METHOD_LABEL[r.current.method] : "", r.current?.basis, d(r.current?.assessedAt), r.current?.assessor, d(r.current?.reassessmentDue)])] };
    }
  }
  throw invalid("Unknown export type.");
}

/** Team / organisation exports. Scope is enforced; every export is recorded in reports and the audit log. */
export async function scopedExport(actor: Actor, type: string): Promise<{ filename: string; rows: Row[] }> {
  let userIds: string[] | null;
  if (type.startsWith("org-")) {
    if (!can(actor, "reports.org")) throw forbidden();
    userIds = null;
  } else {
    if (!can(actor, "team.view")) throw forbidden();
    userIds = await reportingScope(actor.id);
  }
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", ...(userIds ? { id: { in: userIds } } : {}) },
    include: { profile: { include: { department: true, jobRole: true } } },
    orderBy: { name: "asc" },
  });
  const ids = users.map((u) => u.id);
  const now = new Date();
  let rows: Row[];
  let filename: string;
  if (type === "team-learning" || type === "org-learning") {
    const [enr, comp, asg] = await Promise.all([
      prisma.enrollment.groupBy({ by: ["userId", "status"], where: { userId: { in: ids } }, _count: true, _sum: { timeSpentSeconds: true } }),
      prisma.courseCompletion.groupBy({ by: ["userId"], where: { userId: { in: ids }, completedAt: { gte: new Date(now.getFullYear(), 0, 1) } }, _count: true }),
      prisma.learningAssignment.findMany({ where: { userId: { in: ids }, status: { not: "CANCELLED" }, isMandatory: true } }),
    ]);
    rows = [["Employee", "Employee no.", "Department", "Role", "Active enrolments", "Completed (all time)", "Completed this year", "Recorded learning hours", "Mandatory items", "Mandatory overdue"]];
    for (const u of users) {
      const e = enr.filter((x) => x.userId === u.id);
      const a = asg.filter((x) => x.userId === u.id);
      rows.push([u.name, u.profile?.employeeNumber, u.profile?.department?.name, u.profile?.jobRole?.title, e.find((x) => x.status === "ACTIVE")?._count ?? 0, e.find((x) => x.status === "COMPLETED")?._count ?? 0, comp.find((x) => x.userId === u.id)?._count ?? 0, Math.round((e.reduce((s, x) => s + (x._sum.timeSpentSeconds ?? 0), 0) / 3600) * 10) / 10, a.length, a.filter((x) => mandatoryState(x, now) === "OVERDUE").length]);
    }
    filename = `${type}-${d(now)}.csv`;
  } else if (type === "team-compliance" || type === "org-compliance") {
    const asg = await prisma.learningAssignment.findMany({ where: { userId: { in: ids }, isMandatory: true, status: { not: "CANCELLED" } }, include: { course: true, user: { include: { profile: { include: { department: true } } } } }, orderBy: { dueDate: "asc" } });
    rows = [["Employee", "Department", "Course", "Due", "Completed", "Status"], ...asg.map((a) => [a.user.name, a.user.profile?.department?.name, a.course?.title, d(a.dueDate), d(a.completedAt), mandatoryState(a, now)])];
    filename = `${type}-${d(now)}.csv`;
  } else {
    throw invalid("Unknown export type.");
  }
  await prisma.report.create({ data: { type, format: "csv", parameters: { scope: userIds ? "team" : "organisation" }, rowCount: rows.length - 1, generatedById: actor.id } });
  await audit(actor.id, "report.export", "report", null, { type, rows: rows.length - 1 });
  return { filename, rows };
}

/** One-page CPD statement for the caller, generated from approved records. */
export async function cpdStatementPdf(actor: Actor, periodId?: string) {
  const ws = await cpdWorkspace(actor.id, periodId || undefined);
  const [{ branding }, user] = await Promise.all([loadSettingsUncached(), prisma.user.findUniqueOrThrow({ where: { id: actor.id }, include: { profile: { include: { jobRole: true, department: true } } } })]);
  const doc = await PDFDocument.create();
  const sans = safeStandardFont(await doc.embedFont(StandardFonts.Helvetica));
  const bold = safeStandardFont(await doc.embedFont(StandardFonts.HelveticaBold));
  const serif = safeStandardFont(await doc.embedFont(StandardFonts.TimesRomanBold));
  let page = doc.addPage([595, 842]);
  const navy = rgb(0.086, 0.149, 0.267);
  const grey = rgb(0.35, 0.38, 0.42);
  let y = 790;
  const text = (s: string, x: number, size = 9, f = sans, c = grey) => page.drawText(s.length > 95 ? s.slice(0, 94) + "…" : s, { x, y, size, font: f, color: c });
  text(`${branding.organisationName} · ${branding.productName}`, 50, 8);
  y -= 30;
  page.drawText("CPD Statement", { x: 50, y, size: 22, font: serif, color: navy });
  y -= 22;
  text(`${user.name} · ${user.profile?.jobRole?.title ?? ""} · ${user.profile?.department?.name ?? ""}`, 50, 10, bold, navy);
  y -= 16;
  const unit = ws.policy?.unit === "POINTS" ? "points" : "hours";
  text(`Reporting period ${ws.period?.name ?? "—"} · Policy: ${ws.policy?.name ?? "none"} · Target: ${ws.summary?.target ?? "none"} ${ws.summary?.target != null ? unit : ""}`, 50);
  y -= 14;
  text(`Approved: ${ws.summary?.approved ?? 0} ${unit} · Pending: ${ws.summary?.pending ?? 0} ${unit} · Generated ${d(new Date())}`, 50);
  y -= 28;
  const cols = [50, 300, 390, 450, 510];
  ["Activity", "Type", "Date", "Approved", "Recognition"].forEach((h, i) => { page.drawText(h, { x: cols[i], y, size: 8, font: bold, color: navy }); });
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: grey });
  y -= 12;
  for (const c of ws.claims.filter((x) => x.status === "APPROVED")) {
    if (y < 70) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(c.activity.title.slice(0, 48), { x: cols[0], y, size: 8, font: sans, color: rgb(0.1, 0.1, 0.12) });
    page.drawText(CPD_TYPE_LABEL[c.activity.type].slice(0, 18), { x: cols[1], y, size: 8, font: sans, color: grey });
    page.drawText(d(c.activity.activityDate), { x: cols[2], y, size: 8, font: sans, color: grey });
    page.drawText(String(Number(c.approvedValue)), { x: cols[3], y, size: 8, font: sans, color: grey });
    page.drawText(c.recognition === "PROFESSIONAL_BODY" ? "Prof. body" : "Company", { x: cols[4], y, size: 8, font: sans, color: grey });
    y -= 14;
  }
  y -= 14;
  if (y > 60) page.drawText("Approved claims only. Each entry has an auditable approval history in the platform. External recognition is determined by the relevant professional body.", { x: 50, y, size: 7, font: sans, color: grey });
  return { bytes: await doc.save(), filename: `cpd-statement-${ws.period?.name ?? "current"}.pdf` };
}
