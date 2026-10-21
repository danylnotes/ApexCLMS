import { getSettings } from "@/server/settings";
import { PageHeader, Panel } from "@/components/ui";
import { COMPLIANCE_METHOD } from "@/lib/domain/compliance";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Help and Support") };
}

export default async function HelpPage() {
  const { t } = await getI18n();
  const { branding } = await getSettings();
  const FAQ: [string, string][] = [
    [t("How is course completion decided?"), t("Each course defines completion rules — for example all required lessons, a passed final assessment, an approved practical assignment or a signed acknowledgement. The server checks these rules; a certificate is issued only when every rule is met.")],
    [t("Why hasn't my webinar counted towards CPD?"), t("Registration does not count as attendance. After each session the organiser records and verifies attendance. CPD is then processed for verified attendees who met the minimum attendance time.")],
    [t("Does completing a course make me competent?"), t("Course completion is recorded as knowledge evidence. Under the current competency framework, meeting a role requirement also needs demonstrated competence — a workplace observation, practical demonstration or supervisor evaluation. Use “Request a competency assessment” on your Competency Profile.")],
    [t("How is mandatory compliance calculated?"), t(COMPLIANCE_METHOD)],
    [t("What is Career Development Health?"), t("Five separate, rule-based dimensions (learning progress, competency readiness, compliance readiness, professional development and career progression). There is no single score. Each dimension explains how its status is derived. It supports conversations with your manager; it is not used for automated employment decisions.")],
    [t("Who can see my development records?"), t("You, your line management chain and authorised L&D administrators. Executives see aggregated information only. Access is enforced on the server and audited.")],
    [t("My CPD target looks wrong."), t("Targets come from the CPD policy assigned to you (or none). There is no universal target. Ask L&D to confirm the policy that applies to your role.")],
    [t("How do I recertify an expired course?"), t("When a certificate has expired, expires within 90 days, or you are reassigned the course, open the course page and choose “Start recertification”. Your earlier completion remains in your history.")],
  ];
  const contact = t("Email {email} for course access, record corrections or CPD queries. Include your employee number and the course or claim reference.").split("{email}");
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={t("Support")} title={t("Help and Support")} description={t("Answers to common questions about learning records, CPD, competencies and career development.")} />
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-[22px] bg-surface px-5 py-3.5">
            <summary className="cursor-pointer font-sans text-sm font-semibold text-ink">{q}</summary>
            <p className="mt-2 text-[0.9375rem] text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel title={t("Contact Learning & Development")}>
          <p className="text-[0.9375rem]">{contact[0]}<a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a>{contact[1]}</p>
        </Panel>
        <Panel title={t("Accessibility")}>
          <p className="text-[0.9375rem] text-ink-muted">{t("This platform aims to meet WCAG 2.2 AA. It supports keyboard navigation, screen readers, reduced motion and browser zoom to 200%. Status is always shown with text as well as colour. Report any barrier to the support address and we will provide the content in an accessible alternative.")}</p>
        </Panel>
      </div>
    </div>
  );
}
