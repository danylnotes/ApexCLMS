import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { webinarPhase } from "@/server/services/webinars";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Notice, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { CPD_STATUS, WEBINAR_PHASE } from "@/lib/status";
import { fmtDate, fmtDateTime, sentence } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { attendanceAction, processCpdAction, webinarOpsAction } from "../../../staff-actions";
import { WebinarForm } from "../webinar-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Manage webinar") };
}

export default async function WebinarAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const actor = await requirePagePermission("webinar.manage", "course.teach");
  const manager = can(actor, "webinar.manage");
  const { t } = await getI18n();
  const registration: Record<string, string> = { REGISTERED: t("Registered"), WAITLISTED: t("Waitlisted"), CANCELLED: t("Cancelled") };
  const verification: Record<string, string> = { INSTRUCTOR_CONFIRMED: t("Instructor confirmed"), PLATFORM_RECORD: t("Platform record"), ADMIN_PROCESS: t("Admin process") };
  const { id } = await params;
  const { tab = manager ? "details" : "attendance", created } = await searchParams;
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { registrations: { orderBy: { registeredAt: "asc" }, include: { user: { select: { name: true, profile: { select: { department: { select: { name: true } } } } } }, attendance: { include: { recordedBy: { select: { name: true } }, cpdActivity: { include: { claims: { select: { id: true, status: true } } } } } } } }, recordings: true, feedback: true },
  });
  if (!w) notFound();
  const phase = webinarPhase(w);
  const started = w.startsAt <= new Date();
  const base = `/admin/webinars/${id}`;
  const avg = w.feedback.length ? (w.feedback.reduce((s, f) => s + f.rating, 0) / w.feedback.length).toFixed(1) : null;
  const regs = w.registrations.filter((r) => r.status !== "CANCELLED");
  const pendingCpd = regs.filter((r) => r.attendance?.attended && r.attendance.verification !== "UNVERIFIED" && !r.attendance.cpdProcessedAt).length;
  return (
    <div>
      <PageHeader crumbs={[{ label: manager ? t("Webinars") : t("Teaching"), href: manager ? "/admin/webinars" : "/teaching" }, { label: w.code }]} eyebrow={t("Webinar · {code}", { code: w.code })} title={w.title} meta={<><Status tone={WEBINAR_PHASE[phase][1]}>{WEBINAR_PHASE[phase][0]}</Status><span>{fmtDateTime(w.startsAt, w.timeZone)}</span><span>{t("{count} registered", { count: regs.filter((r) => r.status === "REGISTERED").length })}</span>{avg && <span>{t("Feedback {avg}/5 (n={count})", { avg, count: w.feedback.length })}</span>}</>} />
      {created && <div className="mb-6"><Notice tone="ok">{t("Webinar scheduled.")}</Notice></div>}
      <TabNav current={tab} tabs={[...(manager ? [{ key: "details", label: t("Details"), href: base }] : []), { key: "attendance", label: t("Registrations and attendance"), href: `${base}?tab=attendance`, count: regs.length }, ...(manager ? [{ key: "recordings", label: t("Recordings and cancellation"), href: `${base}?tab=recordings` }] : [])]} />
      {tab === "details" && manager && (phase === "CANCELLED" || phase === "COMPLETED" ? <Notice tone="info">{phase === "CANCELLED" ? t("This webinar is cancelled and can no longer be edited.") : t("This webinar is completed and can no longer be edited.")}</Notice> : <Panel><WebinarForm w={w} /></Panel>)}
      {tab === "attendance" && (
        <div className="space-y-6">
          {!started && <Notice tone="info">{t("Attendance can be recorded once the session has started.")}</Notice>}
          {started && (
            <Panel title={t("Record attendance")} description={t("Mark each registrant. Attendance is never inferred from registration. Records become final once CPD is processed.")} bodyClassName="pt-0">
              <ActionForm action={attendanceAction}>
                <input type="hidden" name="webinarId" value={w.id} />
                <Table caption={t("Attendance")}>
                  <thead><tr><Th>{t("Participant")}</Th><Th>{t("Registration")}</Th><Th>{t("Attended?")}</Th><Th>{t("Minutes")}</Th><Th>{t("Current record")}</Th></tr></thead>
                  <tbody>{regs.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium">{r.user.name}<div className="type-meta">{r.user.profile?.department?.name}</div><input type="hidden" name="registrationId" value={r.id} /></Td>
                      <Td>{registration[r.status] ?? sentence(r.status)}</Td>
                      <Td>{r.attendance?.cpdProcessedAt ? <span className="type-meta">{t("Final")}</span> : (
                        <select name={`attended_${r.id}`} defaultValue="" aria-label={t("{name} attended", { name: r.user.name })} className="input-base h-8 w-28 !py-0"><option value="">{t("No change")}</option><option value="yes">{t("Attended")}</option><option value="no">{t("Absent")}</option></select>
                      )}</Td>
                      <Td>{!r.attendance?.cpdProcessedAt && <input name={`minutes_${r.id}`} type="number" min={0} max={1440} defaultValue={r.attendance?.attendedMinutes ?? ""} aria-label={t("{name} minutes attended", { name: r.user.name })} className="input-base h-8 w-20" />}</Td>
                      <Td>{r.attendance ? <>{r.attendance.attended ? t("{n} min", { n: r.attendance.attendedMinutes ?? "—" }) : t("Absent")} · {r.attendance.verification === "UNVERIFIED" ? <Status tone="warn">{t("Unverified")}</Status> : <Status tone="ok">{verification[r.attendance.verification] ?? sentence(r.attendance.verification)}</Status>}<div className="type-meta">{t("by {name}, {date}", { name: r.attendance.recordedBy.name, date: fmtDate(r.attendance.recordedAt) })}{r.attendance.cpdActivity?.claims[0] ? ` · ${t("CPD {status}", { status: (CPD_STATUS[r.attendance.cpdActivity.claims[0].status]?.[0] ?? sentence(r.attendance.cpdActivity.claims[0].status)).toLowerCase() })}` : ""}</div></> : <span className="type-meta">{t("Not recorded")}</span>}</Td>
                    </tr>
                  ))}</tbody>
                </Table>
                <div className="mt-4 grid gap-3 sm:grid-cols-[260px_1fr_auto] sm:items-end">
                  <Field label={t("Verification method")} htmlFor="verification"><select id="verification" name="verification" className="input-base"><option value="INSTRUCTOR_CONFIRMED">{t("Instructor confirmed")}</option><option value="PLATFORM_RECORD">{t("Meeting platform attendance report")}</option>{manager && <option value="ADMIN_PROCESS">{t("Controlled administrative process")}</option>}<option value="UNVERIFIED">{t("Self-declared / cannot verify")}</option></select></Field>
                  <Field label={t("Notes")} htmlFor="notes"><input id="notes" name="notes" className="input-base" placeholder={t("e.g. source of attendance report")} /></Field>
                  <SubmitButton>{t("Save attendance")}</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}
          {manager && w.cpdEligible && started && (
            <Panel title={t("CPD processing")} description={w.minAttendanceMinutes ? t("Raises CPD claims for verified attendees with at least {count, plural, one {# minute} other {# minutes}}. Each attendance is processed once.", { count: w.minAttendanceMinutes }) : t("Raises CPD claims for verified attendees. Each attendance is processed once.")}>
              <ActionForm action={processCpdAction} className="flex items-center gap-3"><input type="hidden" name="webinarId" value={w.id} /><span className="text-[0.875rem]">{t("{count, plural, one {# verified attendance record awaiting CPD processing.} other {# verified attendance records awaiting CPD processing.}}", { count: pendingCpd })}</span><SubmitButton size="sm" variant={pendingCpd ? "primary" : "secondary"}>{t("Process CPD")}</SubmitButton></ActionForm>
            </Panel>
          )}
        </div>
      )}
      {tab === "recordings" && manager && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("Recordings")}>
            <ul className="mb-4 space-y-1 text-[0.875rem]">{w.recordings.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> <span className="type-meta">{r.availableUntil ? t("until {date}", { date: fmtDate(r.availableUntil) }) : ""}</span></li>)}{w.recordings.length === 0 && <li className="type-meta">{t("None.")}</li>}</ul>
            <ActionForm action={webinarOpsAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="webinarId" value={w.id} /><input type="hidden" name="op" value="recording" />
              <Field label={t("Title")} htmlFor="rt"><input id="rt" name="title" required className="input-base" /></Field>
              <Field label={t("URL (access-controlled)")} htmlFor="ru"><input id="ru" name="url" type="url" required className="input-base" /></Field>
              <Field label={t("Duration (min)")} htmlFor="rd"><input id="rd" name="durationMinutes" type="number" className="input-base" /></Field>
              <Field label={t("Available until")} htmlFor="ra"><input id="ra" name="availableUntil" type="date" className="input-base" /></Field>
              <div><SubmitButton size="sm">{t("Add recording")}</SubmitButton></div>
            </ActionForm>
          </Panel>
          {phase !== "CANCELLED" && phase !== "COMPLETED" && (
            <Panel title={t("Cancel webinar")} description={t("Registrants are notified with the reason.")}>
              <ActionForm action={webinarOpsAction} className="space-y-3"><input type="hidden" name="webinarId" value={w.id} /><input type="hidden" name="op" value="cancel" /><Field label={t("Reason")} htmlFor="reason" required><textarea id="reason" name="reason" rows={2} required className="input-base" /></Field><SubmitButton variant="danger" confirm={t("Cancel this webinar and notify registrants?")}>{t("Cancel webinar")}</SubmitButton></ActionForm>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
