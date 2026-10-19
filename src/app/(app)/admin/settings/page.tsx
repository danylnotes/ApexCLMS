import { requirePagePermission } from "@/server/auth/session";
import { loadSettingsUncached } from "@/server/settings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Notice, PageHeader, Panel } from "@/components/ui";
import { settingsAction } from "../../staff-actions";

export const metadata = { title: "Platform Configuration" };

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const s = await loadSettingsUncached();
  const num = (section: string, name: string, label: string, value: number, hint?: string, step = "1") => (
    <Field label={label} htmlFor={`${section}-${name}`} hint={hint}><input id={`${section}-${name}`} name={name} type="number" step={step} defaultValue={value} className="input-base" /></Field>
  );
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Platform Configuration" description="Company identity, security, learning policy, development health rules and notifications. All changes are persisted and audited." />
      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="Company identity and branding">
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="branding" />
            <Field label="Product name" htmlFor="b-p"><input id="b-p" name="productName" defaultValue={s.branding.productName} className="input-base" /></Field>
            <Field label="Organisation name" htmlFor="b-o"><input id="b-o" name="organisationName" defaultValue={s.branding.organisationName} className="input-base" /></Field>
            <Field label="Monogram (1–2 characters)" htmlFor="b-m"><input id="b-m" name="monogram" maxLength={2} defaultValue={s.branding.monogram} className="input-base" /></Field>
            <Field label="Support email" htmlFor="b-s"><input id="b-s" name="supportEmail" type="email" defaultValue={s.branding.supportEmail} className="input-base" /></Field>
            <div className="sm:col-span-2"><Field label="Descriptor" htmlFor="b-d"><input id="b-d" name="descriptor" defaultValue={s.branding.descriptor} className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label="Sign-in headline" htmlFor="b-h"><input id="b-h" name="loginHeadline" defaultValue={s.branding.loginHeadline} className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label="Sign-in introduction" htmlFor="b-b"><textarea id="b-b" name="loginBody" rows={3} defaultValue={s.branding.loginBody} className="input-base" /></Field></div>
            <div><SubmitButton size="sm">Save branding</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Security and sessions">
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="security" />
            {num("s", "sessionTtlHours", "Absolute session lifetime (hours)", s.security.sessionTtlHours)}
            {num("s", "sessionIdleMinutes", "Idle timeout (minutes)", s.security.sessionIdleMinutes)}
            {num("s", "maxFailedLogins", "Failed sign-ins before lockout", s.security.maxFailedLogins)}
            {num("s", "lockoutMinutes", "Lockout duration (minutes)", s.security.lockoutMinutes)}
            <div><SubmitButton size="sm">Save security</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Career Development Health rules" description="Thresholds used by the five transparent dimensions. Each dimension shows its rule to employees.">
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="health" />
            {num("h", "learningOnTrackPercent", "Learning on-track completion (%)", s.health.learningOnTrackPercent)}
            {num("h", "inactivityDays", "Inactivity before attention (days)", s.health.inactivityDays)}
            {num("h", "cpdActionRatio", "CPD action threshold (share of pro-rata)", s.health.cpdActionRatio, "e.g. 0.5 = below 50% of expected", "0.05")}
            {num("h", "dueSoonDays", "Mandatory due-soon window (days)", s.health.dueSoonDays)}
            {num("h", "expiringDays", "Certificate expiry window (days)", s.health.expiringDays)}
            {num("h", "planReviewMonths", "Plan review interval (months)", s.health.planReviewMonths)}
            {num("h", "significantGapLevels", "Significant gap (levels)", s.health.significantGapLevels)}
            <div className="self-end"><SubmitButton size="sm">Save rules</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Learning completion policy">
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="learning" />
            {num("l", "defaultPassingScore", "Default pass mark (%)", s.learning.defaultPassingScore)}
            {num("l", "defaultMaxAttempts", "Default attempts (0 = unlimited)", s.learning.defaultMaxAttempts)}
            {num("l", "mandatoryDueSoonDays", "Mandatory 'due soon' window (days)", s.learning.mandatoryDueSoonDays)}
            <div className="self-end"><SubmitButton size="sm">Save policy</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Notifications">
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="notifications" />
            <label className="flex items-center gap-2 font-sans text-sm sm:col-span-2"><input type="checkbox" name="emailEnabled" defaultChecked={s.notifications.emailEnabled} className="h-4 w-4 accent-[rgb(22,38,68)]" />Send email for events where users have opted in</label>
            {num("n", "webinarReminderHours", "Webinar reminder lead time (hours)", s.notifications.webinarReminderHours)}
            <div className="self-end"><SubmitButton size="sm">Save notifications</SubmitButton></div>
          </ActionForm>
          <div className="mt-4"><Notice tone="info">Email provider: <b>{process.env.EMAIL_PROVIDER ?? "outbox"}</b>. The outbox provider records messages in the database for a relay; SMTP delivery requires the integration described in the deployment guide.</Notice></div>
        </Panel>
        <Panel title="Other configuration">
          <ul className="space-y-1.5 text-[0.875rem]">
            <li><a href="/admin/organisation">Departments, job roles and course categories</a></li>
            <li><a href="/admin/cpd?tab=policies">CPD rules</a> and <a href="/admin/cpd?tab=periods">reporting periods</a></li>
            <li><a href="/admin/certificates">Certificate templates</a></li>
            <li><a href="/admin/competencies">Competency frameworks</a></li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
