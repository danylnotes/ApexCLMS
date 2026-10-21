import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, KeyValue, LinkButton, PageHeader, Panel, Status } from "@/components/ui";
import { fmtDate, fmtRelative } from "@/lib/format";
import { changePasswordAction, preferencesAction, revokeSessionAction, updateProfileAction } from "./actions";
import { NOTIFICATION_TYPES } from "./types";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Profile and Settings") };
}

export default async function ProfilePage() {
  const { t } = await getI18n();
  const actor = await requireActor();
  const [user, prefs, sessions, managers, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.id }, include: { profile: { include: { jobRole: true, targetJobRole: true, department: true, businessUnit: true, cpdPolicy: true } }, roles: { include: { role: true } } } }),
    prisma.notificationPreference.findMany({ where: { userId: actor.id } }),
    prisma.session.findMany({ where: { userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    prisma.managerRelationship.findMany({ where: { employeeId: actor.id, endDate: null }, include: { manager: { select: { name: true } } } }),
    getSettings(),
  ]);
  const pref = (type: string) => prefs.find((p) => p.type === type);
  const p = user.profile;
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow={t("Account")} title={t("Profile and Settings")} description={t("Organisational details are maintained by HR and L&D. Contact them to correct your role, department or manager.")} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title={t("Your profile")}>
          <KeyValue items={[[t("Name"), user.name], [t("Email"), user.email], [t("Employee number"), p?.employeeNumber], [t("Job role"), p?.jobRole?.title], [t("Target role"), p?.targetJobRole?.title], [t("Department"), p?.department?.name], [t("Business unit"), p?.businessUnit?.name], [t("Location"), p?.location], [t("Line manager"), managers.map((m) => m.manager.name).join(", ") || "—"], [t("Hire date"), fmtDate(p?.hireDate)], [t("CPD policy"), p?.cpdPolicy?.name ?? t("None")], [t("Platform roles"), user.roles.map((r) => r.role.name).join(", ")]]} />
          <ActionForm action={updateProfileAction} className="mt-6 space-y-3 border-t border-line pt-5">
            <Field label={t("Phone")} htmlFor="phone"><input id="phone" name="phone" defaultValue={p?.phone ?? ""} className="input-base" autoComplete="tel" /></Field>
            <Field label={t("Professional summary")} htmlFor="bio"><textarea id="bio" name="bio" rows={3} defaultValue={p?.bio ?? ""} className="input-base" maxLength={1000} /></Field>
            <SubmitButton size="sm">{t("Save profile")}</SubmitButton>
          </ActionForm>
        </Panel>
        <div className="space-y-8">
          <Panel title={t("Change password")}>
            <ActionForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
              <Field label={t("Current password")} htmlFor="current"><input id="current" name="current" type="password" autoComplete="current-password" required className="input-base" /></Field>
              <Field label={t("New password")} htmlFor="next" hint={t("At least 12 characters with upper and lower case, a number and a symbol.")}><input id="next" name="next" type="password" autoComplete="new-password" required className="input-base" /></Field>
              <Field label={t("Confirm new password")} htmlFor="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input-base" /></Field>
              <SubmitButton size="sm">{t("Change password")}</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title={t("Active sessions")} description={t("Sessions end after {minutes} minutes of inactivity or {hours} hours in total.", { minutes: settings.security.sessionIdleMinutes, hours: settings.security.sessionTtlHours })}>
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.8125rem] first:pt-0">
                  <span className="min-w-0"><span className="block truncate">{s.userAgent?.slice(0, 60) ?? t("Unknown device")}</span><span className="type-meta">{t("Started {date} · active {relative}", { date: fmtDate(s.createdAt), relative: fmtRelative(s.lastSeenAt) })}{s.ip ? ` · ${s.ip}` : ""}</span></span>
                  {s.id === actor.sessionId ? <Status tone="ok">{t("This session")}</Status> : <ActionForm action={revokeSessionAction} inline><input type="hidden" name="sessionId" value={s.id} /><SubmitButton size="sm" variant="secondary">{t("Sign out")}</SubmitButton></ActionForm>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t("Your records")}>
            <p className="mb-3 text-[0.875rem] text-ink-muted">{t("Download copies of your own development records.")}</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/api/v1/exports/history" variant="secondary" size="sm">{t("Learning history")}</LinkButton>
              <LinkButton href="/api/v1/exports/completions" variant="secondary" size="sm">{t("Completions")}</LinkButton>
              <LinkButton href="/api/v1/exports/cpd-statement" variant="secondary" size="sm">{t("CPD statement")}</LinkButton>
              <LinkButton href="/api/v1/exports/competency" variant="secondary" size="sm">{t("Competency record")}</LinkButton>
            </div>
          </Panel>
        </div>
      </div>
      <Panel id="notifications" title={t("Notification preferences")} className="mt-8" description={settings.notifications.emailEnabled ? t("Choose how you are notified about each event.") : t("Email delivery is currently disabled by your administrator; email preferences will apply when it is enabled.")}>
        <ActionForm action={preferencesAction}>
          <table className="w-full font-sans text-[0.8125rem]">
            <thead><tr className="border-b border-line text-start text-ink-faint"><th className="py-2 font-medium">{t("Event")}</th><th className="w-24 text-center font-medium">{t("In-app")}</th><th className="w-24 text-center font-medium">{t("Email")}</th></tr></thead>
            <tbody>
              {NOTIFICATION_TYPES.map((n) => (
                <tr key={n.type} className="border-b border-line">
                  <td className="py-2">{t(n.label)}</td>
                  <td className="text-center"><input type="checkbox" name={`inApp_${n.type}`} defaultChecked={pref(n.type)?.inApp ?? true} aria-label={t("{event} in-app", { event: t(n.label) })} className="h-4 w-4 accent-[rgb(22,38,68)]" /></td>
                  <td className="text-center"><input type="checkbox" name={`email_${n.type}`} defaultChecked={pref(n.type)?.email ?? false} aria-label={t("{event} by email", { event: t(n.label) })} className="h-4 w-4 accent-[rgb(22,38,68)]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4"><SubmitButton size="sm">{t("Save preferences")}</SubmitButton></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
