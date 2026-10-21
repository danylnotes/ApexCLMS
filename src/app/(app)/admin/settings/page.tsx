import { requirePagePermission } from "@/server/auth/session";
import { loadSettingsUncached } from "@/server/settings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Notice, PageHeader, Panel } from "@/components/ui";
import { settingsAction } from "../../staff-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Platform Configuration") };
}

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const { t } = await getI18n();
  const s = await loadSettingsUncached();
  const num = (section: string, name: string, label: string, value: number, hint?: string, step = "1") => (
    <Field label={label} htmlFor={`${section}-${name}`} hint={hint}><input id={`${section}-${name}`} name={name} type="number" step={step} defaultValue={value} className="input-base" /></Field>
  );
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Platform Configuration")} description={t("Company identity, security, learning policy, development health rules and notifications. All changes are persisted and audited.")} />
      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title={t("Company identity and branding")}>
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="branding" />
            <Field label={t("Product name")} htmlFor="b-p"><input id="b-p" name="productName" defaultValue={s.branding.productName} className="input-base" /></Field>
            <Field label={t("Organisation name")} htmlFor="b-o"><input id="b-o" name="organisationName" defaultValue={s.branding.organisationName} className="input-base" /></Field>
            <Field label={t("Monogram (1–2 characters)")} htmlFor="b-m"><input id="b-m" name="monogram" maxLength={2} defaultValue={s.branding.monogram} className="input-base" /></Field>
            <Field label={t("Support email")} htmlFor="b-s"><input id="b-s" name="supportEmail" type="email" defaultValue={s.branding.supportEmail} className="input-base" /></Field>
            <div className="sm:col-span-2"><Field label={t("Descriptor")} htmlFor="b-d"><input id="b-d" name="descriptor" defaultValue={s.branding.descriptor} className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Sign-in headline")} htmlFor="b-h"><input id="b-h" name="loginHeadline" defaultValue={s.branding.loginHeadline} className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Sign-in introduction")} htmlFor="b-b"><textarea id="b-b" name="loginBody" rows={3} defaultValue={s.branding.loginBody} className="input-base" /></Field></div>
            <div><SubmitButton size="sm">{t("Save branding")}</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title={t("Security and sessions")}>
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="security" />
            {num("s", "sessionTtlHours", t("Absolute session lifetime (hours)"), s.security.sessionTtlHours)}
            {num("s", "sessionIdleMinutes", t("Idle timeout (minutes)"), s.security.sessionIdleMinutes)}
            {num("s", "maxFailedLogins", t("Failed sign-ins before lockout"), s.security.maxFailedLogins)}
            {num("s", "lockoutMinutes", t("Lockout duration (minutes)"), s.security.lockoutMinutes)}
            <div><SubmitButton size="sm">{t("Save security")}</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title={t("Career Development Health rules")} description={t("Thresholds used by the five transparent dimensions. Each dimension shows its rule to employees.")}>
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="health" />
            {num("h", "learningOnTrackPercent", t("Learning on-track completion (%)"), s.health.learningOnTrackPercent)}
            {num("h", "inactivityDays", t("Inactivity before attention (days)"), s.health.inactivityDays)}
            {num("h", "cpdActionRatio", t("CPD action threshold (share of pro-rata)"), s.health.cpdActionRatio, t("e.g. 0.5 = below 50% of expected"), "0.05")}
            {num("h", "dueSoonDays", t("Mandatory due-soon window (days)"), s.health.dueSoonDays)}
            {num("h", "expiringDays", t("Certificate expiry window (days)"), s.health.expiringDays)}
            {num("h", "planReviewMonths", t("Plan review interval (months)"), s.health.planReviewMonths)}
            {num("h", "significantGapLevels", t("Significant gap (levels)"), s.health.significantGapLevels)}
            <div className="self-end"><SubmitButton size="sm">{t("Save rules")}</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title={t("Learning completion policy")}>
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="learning" />
            {num("l", "defaultPassingScore", t("Default pass mark (%)"), s.learning.defaultPassingScore)}
            {num("l", "defaultMaxAttempts", t("Default attempts (0 = unlimited)"), s.learning.defaultMaxAttempts)}
            {num("l", "mandatoryDueSoonDays", t("Mandatory 'due soon' window (days)"), s.learning.mandatoryDueSoonDays)}
            <div className="self-end"><SubmitButton size="sm">{t("Save policy")}</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title={t("Notifications")}>
          <ActionForm action={settingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="notifications" />
            <label className="flex items-center gap-2 font-sans text-sm sm:col-span-2"><input type="checkbox" name="emailEnabled" defaultChecked={s.notifications.emailEnabled} className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Send email for events where users have opted in")}</label>
            {num("n", "webinarReminderHours", t("Webinar reminder lead time (hours)"), s.notifications.webinarReminderHours)}
            <div className="self-end"><SubmitButton size="sm">{t("Save notifications")}</SubmitButton></div>
          </ActionForm>
          <div className="mt-4"><Notice tone="info">{t("Email provider:")} <b>{process.env.EMAIL_PROVIDER ?? "outbox"}</b>. {t("The outbox provider records messages in the database for a relay; SMTP delivery requires the integration described in the deployment guide.")}</Notice></div>
        </Panel>
        <Panel title={t("Other configuration")}>
          <ul className="space-y-1.5 text-[0.875rem]">
            <li><a href="/admin/organisation">{t("Departments, job roles and course categories")}</a></li>
            <li><a href="/admin/cpd?tab=policies">{t("CPD rules")}</a> {t("and")} <a href="/admin/cpd?tab=periods">{t("reporting periods")}</a></li>
            <li><a href="/admin/certificates">{t("Certificate templates")}</a></li>
            <li><a href="/admin/competencies">{t("Competency frameworks")}</a></li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
