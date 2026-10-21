import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { canOperateWebinars } from "@/server/policy";
import { webinarPhase } from "@/server/services/webinars";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KeyValue, LinkButton, Notice, PageHeader, Panel, Status } from "@/components/ui";
import { WEBINAR_PHASE } from "@/lib/status";
import { fmtDate, fmtDateTime, fmtMinutes, fmtNum, sentence } from "@/lib/format";
import { cancelWebinarAction, registerWebinarAction, webinarFeedbackAction } from "../../learner-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const w = await prisma.webinar.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return { title: w?.title ?? t("Webinar") };
}

export default async function WebinarDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const { slug } = await params;
  const w = await prisma.webinar.findUnique({ where: { slug }, include: { category: true, recordings: true, _count: { select: { registrations: { where: { status: "REGISTERED" } } } } } });
  if (!w || (w.status === "DRAFT" && !canOperateWebinars(actor))) notFound();
  const reg = await prisma.webinarRegistration.findUnique({ where: { webinarId_userId: { webinarId: w.id, userId: actor.id } }, include: { attendance: { include: { cpdActivity: { include: { claims: true } } } } } });
  const fb = await prisma.webinarFeedback.findUnique({ where: { webinarId_userId: { webinarId: w.id, userId: actor.id } } });
  const phase = webinarPhase(w);
  const [label, tone] = WEBINAR_PHASE[phase];
  const registered = reg && reg.status !== "CANCELLED";
  const canJoin = registered && reg.status === "REGISTERED" && (phase === "LIVE" || phase === "UPCOMING") && w.meetingUrl;
  const agenda = (w.agenda as { time: string; item: string }[] | null) ?? [];
  const resources = (w.resources as { label: string; url: string }[] | null) ?? [];
  const att = reg?.attendance;
  const claim = att?.cpdActivity?.claims[0];
  const verificationLabel = (v: string) => ({ INSTRUCTOR_CONFIRMED: t("Instructor confirmed"), PLATFORM_RECORD: t("Platform record"), ADMIN_PROCESS: t("Admin process") })[v] ?? sentence(v);
  const providerLabel = (p: string) => (p === "NONE" ? t("None") : p === "OTHER" ? t("Other") : sentence(p));

  let action: React.ReactNode = null;
  if (phase === "UPCOMING" || phase === "LIVE") {
    action = registered ? (
      <div className="flex flex-wrap gap-2">
        {canJoin && phase === "LIVE" && <LinkButton href={w.meetingUrl!} variant="accent" target="_blank" rel="noopener noreferrer">{t("Join session")}</LinkButton>}
        <LinkButton href={`/api/v1/webinars/${w.id}/ics`} variant="secondary"><CalendarPlus className="h-4 w-4" aria-hidden /> {t("Add to calendar")}</LinkButton>
        <ActionForm action={cancelWebinarAction} inline><input type="hidden" name="webinarId" value={w.id} /><SubmitButton variant="ghost" confirm={t("Cancel your registration?")}>{t("Cancel registration")}</SubmitButton></ActionForm>
      </div>
    ) : (
      <ActionForm action={registerWebinarAction} inline><input type="hidden" name="webinarId" value={w.id} /><SubmitButton>{w.capacity != null && w._count.registrations >= w.capacity ? t("Join waitlist") : t("Register")}</SubmitButton></ActionForm>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: t("Webinars and Events"), href: "/webinars" }, { label: w.title }]}
        eyebrow={`${w.category?.name ?? t("Webinar")} · ${w.code}`}
        title={w.title}
        description={w.synopsis}
        actions={action}
        meta={<><Status tone={tone}>{label}</Status><span>{fmtDateTime(w.startsAt, w.timeZone)}</span><span>{fmtMinutes(w.durationMinutes)}</span><span>{t("Time zone: {zone}", { zone: w.timeZone })}</span>{registered && <Status tone={reg.status === "WAITLISTED" ? "warn" : "ok"} glyph={false}>{reg.status === "WAITLISTED" ? t("On waitlist") : t("You are registered")}</Status>}</>}
      />
      {phase === "CANCELLED" && <div className="mb-6"><Notice tone="crit" title={t("This session has been cancelled")}>{w.cancellationReason}</Notice></div>}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="type-title mb-2">{t("Overview")}</h2>
            <p className="prose-lesson">{w.overview}</p>
            {w.objectives.length > 0 && (<><h3 className="type-section mt-6">{t("Learning objectives")}</h3><ul className="mt-2 list-disc space-y-1 ps-5 text-[0.9375rem]">{w.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></>)}
          </section>
          {agenda.length > 0 && (
            <Panel title={t("Event schedule")}>
              <ol className="divide-y divide-line">{agenda.map((a, i) => <li key={i} className="flex gap-4 py-2 text-[0.875rem]"><span className="w-14 shrink-0 font-sans tabular-nums text-ink-faint">{a.time}</span>{a.item}</li>)}</ol>
            </Panel>
          )}
          <Panel title={t("Speaker")}>
            <p className="font-sans text-sm font-semibold">{w.speakerName}</p>
            {w.speakerTitle && <p className="type-meta">{w.speakerTitle}</p>}
            {w.speakerBio && <p className="mt-2 text-[0.9rem] text-ink-muted">{w.speakerBio}</p>}
          </Panel>
          {phase === "COMPLETED" && att?.attended && (
            <Panel title={t("Post-event feedback")} description={t("Your feedback helps L&D evaluate session effectiveness.")}>
              <ActionForm action={webinarFeedbackAction} className="space-y-4">
                <input type="hidden" name="webinarId" value={w.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="rating" className="block font-sans text-[0.8125rem] font-medium">{t("Overall rating")}</label><select id="rating" name="rating" defaultValue={fb?.rating ?? 4} className="input-base">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} — {["", t("Poor"), t("Fair"), t("Good"), t("Very good"), t("Excellent")][n]}</option>)}</select></div>
                  <div><label htmlFor="relevance" className="block font-sans text-[0.8125rem] font-medium">{t("Relevance to your role")}</label><select id="relevance" name="relevance" defaultValue={fb?.relevance ?? 4} className="input-base">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                </div>
                <div><label htmlFor="comments" className="block font-sans text-[0.8125rem] font-medium">{t("Comments")}</label><textarea id="comments" name="comments" rows={3} defaultValue={fb?.comments ?? ""} className="input-base" /></div>
                <SubmitButton size="sm">{fb ? t("Update feedback") : t("Submit feedback")}</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </div>
        <aside className="space-y-6">
          <Panel title={t("Your participation")}>
            <KeyValue cols={1} items={[
              [t("Registration"), registered ? (reg.status === "WAITLISTED" ? t("Waitlisted {date}", { date: fmtDate(reg.registeredAt) }) : t("Registered {date}", { date: fmtDate(reg.registeredAt) })) : t("Not registered")],
              [t("Attendance"), !att ? (phase === "COMPLETED" && registered ? t("Not yet recorded") : "—") : att.attended ? t("{n} minutes", { n: att.attendedMinutes ?? "—" }) : t("Did not attend")],
              [t("Verification"), att ? (att.verification === "UNVERIFIED" ? t("Not independently verified") : verificationLabel(att.verification)) : "—"],
              [t("CPD"), claim ? (claim.status === "APPROVED" ? t("{n} approved", { n: fmtNum(claim.approvedValue?.toString()) }) : t("{n} pending review", { n: fmtNum(claim.claimedValue.toString()) })) : w.cpdEligible ? t("Processed after verified attendance") : t("Not CPD-eligible")],
            ]} />
            {canJoin && phase === "UPCOMING" && <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] text-ink-muted">{t("Meeting link ({provider}):", { provider: providerLabel(w.meetingProvider) })} <a href={w.meetingUrl!} target="_blank" rel="noopener noreferrer" className="break-all">{w.meetingUrl}</a></p>}
            {!registered && w.meetingUrl && <p className="mt-3 border-t border-line pt-3 type-meta">{t("The meeting link is shown to registered participants only.")}</p>}
          </Panel>
          <Panel title={t("Requirements and CPD")}>
            <KeyValue cols={1} items={[
              [t("Registration"), w.registrationRequirements ?? t("Open to all employees")],
              [t("Attendance"), w.minAttendanceMinutes ? t("Attend at least {n} minutes, verified by the organiser", { n: w.minAttendanceMinutes }) : t("Attendance verified by the organiser")],
              [t("CPD value"), w.cpdEligible ? (w.cpdUnit === "POINTS" ? t("{n} points for verified, eligible attendance", { n: fmtNum(w.cpdValue?.toString()) }) : t("{n} hours for verified, eligible attendance", { n: fmtNum(w.cpdValue?.toString()) })) : t("Not CPD-eligible")],
              [t("Capacity"), w.capacity ? t("{taken} of {capacity} places taken", { taken: w._count.registrations, capacity: w.capacity }) : t("Unlimited")],
            ]} />
          </Panel>
          <Panel title={t("Recordings and resources")}>
            {w.recordings.length === 0 && resources.length === 0 ? <p className="type-meta">{phase === "COMPLETED" ? t("No recording has been published.") : t("Recordings are published after the session where available.")}</p> : (
              <ul className="space-y-2 text-[0.875rem]">
                {w.recordings.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a><span className="type-meta"> · {fmtMinutes(r.durationMinutes)}{r.availableUntil ? ` · ${t("until {date}", { date: fmtDate(r.availableUntil) })}` : ""}</span></li>)}
                {resources.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a></li>)}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
