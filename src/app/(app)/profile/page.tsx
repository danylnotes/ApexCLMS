import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, KeyValue, LinkButton, PageHeader, Panel, Status } from "@/components/ui";
import { fmtDate, fmtRelative } from "@/lib/format";
import { changePasswordAction, preferencesAction, revokeSessionAction, updateProfileAction } from "./actions";
import { NOTIFICATION_TYPES } from "./types";

export const metadata = { title: "Profile and Settings" };

export default async function ProfilePage() {
  const actor = await requireActor();
  const [user, prefs, sessions, managers, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.id }, include: { profile: { include: { jobRole: true, targetJobRole: true, department: true, businessUnit: true, cpdPolicy: true } }, roles: { include: { role: true } } } }),
    prisma.notificationPreference.findMany({ where: { userId: actor.id } }),
    prisma.session.findMany({ where: { userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    prisma.managerRelationship.findMany({ where: { employeeId: actor.id, endDate: null }, include: { manager: { select: { name: true } } } }),
    getSettings(),
  ]);
  const pref = (t: string) => prefs.find((p) => p.type === t);
  const p = user.profile;
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="Account" title="Profile and Settings" description="Organisational details are maintained by HR and L&D. Contact them to correct your role, department or manager." />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Your profile">
          <KeyValue items={[["Name", user.name], ["Email", user.email], ["Employee number", p?.employeeNumber], ["Job role", p?.jobRole?.title], ["Target role", p?.targetJobRole?.title], ["Department", p?.department?.name], ["Business unit", p?.businessUnit?.name], ["Location", p?.location], ["Line manager", managers.map((m) => m.manager.name).join(", ") || "—"], ["Hire date", fmtDate(p?.hireDate)], ["CPD policy", p?.cpdPolicy?.name ?? "None"], ["Platform roles", user.roles.map((r) => r.role.name).join(", ")]]} />
          <ActionForm action={updateProfileAction} className="mt-6 space-y-3 border-t border-line pt-5">
            <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" defaultValue={p?.phone ?? ""} className="input-base" autoComplete="tel" /></Field>
            <Field label="Professional summary" htmlFor="bio"><textarea id="bio" name="bio" rows={3} defaultValue={p?.bio ?? ""} className="input-base" maxLength={1000} /></Field>
            <SubmitButton size="sm">Save profile</SubmitButton>
          </ActionForm>
        </Panel>
        <div className="space-y-8">
          <Panel title="Change password">
            <ActionForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
              <Field label="Current password" htmlFor="current"><input id="current" name="current" type="password" autoComplete="current-password" required className="input-base" /></Field>
              <Field label="New password" htmlFor="next" hint="At least 12 characters with upper and lower case, a number and a symbol."><input id="next" name="next" type="password" autoComplete="new-password" required className="input-base" /></Field>
              <Field label="Confirm new password" htmlFor="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input-base" /></Field>
              <SubmitButton size="sm">Change password</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="Active sessions" description={`Sessions end after ${settings.security.sessionIdleMinutes} minutes of inactivity or ${settings.security.sessionTtlHours} hours in total.`}>
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.8125rem] first:pt-0">
                  <span className="min-w-0"><span className="block truncate">{s.userAgent?.slice(0, 60) ?? "Unknown device"}</span><span className="type-meta">Started {fmtDate(s.createdAt)} · active {fmtRelative(s.lastSeenAt)}{s.ip ? ` · ${s.ip}` : ""}</span></span>
                  {s.id === actor.sessionId ? <Status tone="ok">This session</Status> : <ActionForm action={revokeSessionAction} inline><input type="hidden" name="sessionId" value={s.id} /><SubmitButton size="sm" variant="secondary">Sign out</SubmitButton></ActionForm>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Your records">
            <p className="mb-3 text-[0.875rem] text-ink-muted">Download copies of your own development records.</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/api/v1/exports/history" variant="secondary" size="sm">Learning history</LinkButton>
              <LinkButton href="/api/v1/exports/completions" variant="secondary" size="sm">Completions</LinkButton>
              <LinkButton href="/api/v1/exports/cpd-statement" variant="secondary" size="sm">CPD statement</LinkButton>
              <LinkButton href="/api/v1/exports/competency" variant="secondary" size="sm">Competency record</LinkButton>
            </div>
          </Panel>
        </div>
      </div>
      <Panel id="notifications" title="Notification preferences" className="mt-8" description={settings.notifications.emailEnabled ? "Choose how you are notified about each event." : "Email delivery is currently disabled by your administrator; email preferences will apply when it is enabled."}>
        <ActionForm action={preferencesAction}>
          <table className="w-full font-sans text-[0.8125rem]">
            <thead><tr className="border-b border-line text-left text-ink-faint"><th className="py-2 font-medium">Event</th><th className="w-24 text-center font-medium">In-app</th><th className="w-24 text-center font-medium">Email</th></tr></thead>
            <tbody>
              {NOTIFICATION_TYPES.map((t) => (
                <tr key={t.type} className="border-b border-line">
                  <td className="py-2">{t.label}</td>
                  <td className="text-center"><input type="checkbox" name={`inApp_${t.type}`} defaultChecked={pref(t.type)?.inApp ?? true} aria-label={`${t.label} in-app`} className="h-4 w-4 accent-[rgb(22,38,68)]" /></td>
                  <td className="text-center"><input type="checkbox" name={`email_${t.type}`} defaultChecked={pref(t.type)?.email ?? false} aria-label={`${t.label} by email`} className="h-4 w-4 accent-[rgb(22,38,68)]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4"><SubmitButton size="sm">Save preferences</SubmitButton></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
