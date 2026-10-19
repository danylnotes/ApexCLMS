import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { webinarPhase } from "@/server/services/webinars";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Notice, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { WEBINAR_PHASE } from "@/lib/status";
import { fmtDate, fmtDateTime, sentence } from "@/lib/format";
import { attendanceAction, processCpdAction, webinarOpsAction } from "../../../staff-actions";
import { WebinarForm } from "../webinar-form";

export const metadata = { title: "Manage webinar" };

export default async function WebinarAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const actor = await requirePagePermission("webinar.manage", "course.teach");
  const manager = can(actor, "webinar.manage");
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
      <PageHeader crumbs={[{ label: manager ? "Webinars" : "Teaching", href: manager ? "/admin/webinars" : "/teaching" }, { label: w.code }]} eyebrow={`Webinar · ${w.code}`} title={w.title} meta={<><Status tone={WEBINAR_PHASE[phase][1]}>{WEBINAR_PHASE[phase][0]}</Status><span>{fmtDateTime(w.startsAt, w.timeZone)}</span><span>{regs.filter((r) => r.status === "REGISTERED").length} registered</span>{avg && <span>Feedback {avg}/5 (n={w.feedback.length})</span>}</>} />
      {created && <div className="mb-6"><Notice tone="ok">Webinar scheduled.</Notice></div>}
      <TabNav current={tab} tabs={[...(manager ? [{ key: "details", label: "Details", href: base }] : []), { key: "attendance", label: "Registrations and attendance", href: `${base}?tab=attendance`, count: regs.length }, ...(manager ? [{ key: "recordings", label: "Recordings and cancellation", href: `${base}?tab=recordings` }] : [])]} />
      {tab === "details" && manager && (phase === "CANCELLED" || phase === "COMPLETED" ? <Notice tone="info">This webinar is {phase.toLowerCase()} and can no longer be edited.</Notice> : <Panel><WebinarForm w={w} /></Panel>)}
      {tab === "attendance" && (
        <div className="space-y-6">
          {!started && <Notice tone="info">Attendance can be recorded once the session has started.</Notice>}
          {started && (
            <Panel title="Record attendance" description="Mark each registrant. Attendance is never inferred from registration. Records become final once CPD is processed." bodyClassName="pt-0">
              <ActionForm action={attendanceAction}>
                <input type="hidden" name="webinarId" value={w.id} />
                <Table caption="Attendance">
                  <thead><tr><Th>Participant</Th><Th>Registration</Th><Th>Attended?</Th><Th>Minutes</Th><Th>Current record</Th></tr></thead>
                  <tbody>{regs.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium">{r.user.name}<div className="type-meta">{r.user.profile?.department?.name}</div><input type="hidden" name="registrationId" value={r.id} /></Td>
                      <Td>{sentence(r.status)}</Td>
                      <Td>{r.attendance?.cpdProcessedAt ? <span className="type-meta">Final</span> : (
                        <select name={`attended_${r.id}`} defaultValue="" aria-label={`${r.user.name} attended`} className="input-base h-8 w-28 !py-0"><option value="">No change</option><option value="yes">Attended</option><option value="no">Absent</option></select>
                      )}</Td>
                      <Td>{!r.attendance?.cpdProcessedAt && <input name={`minutes_${r.id}`} type="number" min={0} max={1440} defaultValue={r.attendance?.attendedMinutes ?? ""} aria-label={`${r.user.name} minutes attended`} className="input-base h-8 w-20" />}</Td>
                      <Td>{r.attendance ? <>{r.attendance.attended ? `${r.attendance.attendedMinutes ?? "—"} min` : "Absent"} · {r.attendance.verification === "UNVERIFIED" ? <Status tone="warn">Unverified</Status> : <Status tone="ok">{sentence(r.attendance.verification)}</Status>}<div className="type-meta">by {r.attendance.recordedBy.name}, {fmtDate(r.attendance.recordedAt)}{r.attendance.cpdActivity?.claims[0] ? ` · CPD ${r.attendance.cpdActivity.claims[0].status.toLowerCase()}` : ""}</div></> : <span className="type-meta">Not recorded</span>}</Td>
                    </tr>
                  ))}</tbody>
                </Table>
                <div className="mt-4 grid gap-3 sm:grid-cols-[260px_1fr_auto] sm:items-end">
                  <Field label="Verification method" htmlFor="verification"><select id="verification" name="verification" className="input-base"><option value="INSTRUCTOR_CONFIRMED">Instructor confirmed</option><option value="PLATFORM_RECORD">Meeting platform attendance report</option>{manager && <option value="ADMIN_PROCESS">Controlled administrative process</option>}<option value="UNVERIFIED">Self-declared / cannot verify</option></select></Field>
                  <Field label="Notes" htmlFor="notes"><input id="notes" name="notes" className="input-base" placeholder="e.g. source of attendance report" /></Field>
                  <SubmitButton>Save attendance</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}
          {manager && w.cpdEligible && started && (
            <Panel title="CPD processing" description={`Raises CPD claims for verified attendees${w.minAttendanceMinutes ? ` with at least ${w.minAttendanceMinutes} minutes` : ""}. Each attendance is processed once.`}>
              <ActionForm action={processCpdAction} className="flex items-center gap-3"><input type="hidden" name="webinarId" value={w.id} /><span className="text-[0.875rem]">{pendingCpd} verified attendance record{pendingCpd === 1 ? "" : "s"} awaiting CPD processing.</span><SubmitButton size="sm" variant={pendingCpd ? "primary" : "secondary"}>Process CPD</SubmitButton></ActionForm>
            </Panel>
          )}
        </div>
      )}
      {tab === "recordings" && manager && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Recordings">
            <ul className="mb-4 space-y-1 text-[0.875rem]">{w.recordings.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> <span className="type-meta">{r.availableUntil ? `until ${fmtDate(r.availableUntil)}` : ""}</span></li>)}{w.recordings.length === 0 && <li className="type-meta">None.</li>}</ul>
            <ActionForm action={webinarOpsAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="webinarId" value={w.id} /><input type="hidden" name="op" value="recording" />
              <Field label="Title" htmlFor="rt"><input id="rt" name="title" required className="input-base" /></Field>
              <Field label="URL (access-controlled)" htmlFor="ru"><input id="ru" name="url" type="url" required className="input-base" /></Field>
              <Field label="Duration (min)" htmlFor="rd"><input id="rd" name="durationMinutes" type="number" className="input-base" /></Field>
              <Field label="Available until" htmlFor="ra"><input id="ra" name="availableUntil" type="date" className="input-base" /></Field>
              <div><SubmitButton size="sm">Add recording</SubmitButton></div>
            </ActionForm>
          </Panel>
          {phase !== "CANCELLED" && phase !== "COMPLETED" && (
            <Panel title="Cancel webinar" description="Registrants are notified with the reason.">
              <ActionForm action={webinarOpsAction} className="space-y-3"><input type="hidden" name="webinarId" value={w.id} /><input type="hidden" name="op" value="cancel" /><Field label="Reason" htmlFor="reason" required><textarea id="reason" name="reason" rows={2} required className="input-base" /></Field><SubmitButton variant="danger" confirm="Cancel this webinar and notify registrants?">Cancel webinar</SubmitButton></ActionForm>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
