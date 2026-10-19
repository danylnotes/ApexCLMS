import { getSettings } from "@/server/settings";
import { PageHeader, Panel } from "@/components/ui";
import { COMPLIANCE_METHOD } from "@/lib/domain/compliance";

export const metadata = { title: "Help and Support" };

const FAQ: [string, string][] = [
  ["How is course completion decided?", "Each course defines completion rules — for example all required lessons, a passed final assessment, an approved practical assignment or a signed acknowledgement. The server checks these rules; a certificate is issued only when every rule is met."],
  ["Why hasn't my webinar counted towards CPD?", "Registration does not count as attendance. After each session the organiser records and verifies attendance. CPD is then processed for verified attendees who met the minimum attendance time."],
  ["Does completing a course make me competent?", "Course completion is recorded as knowledge evidence. Under the current competency framework, meeting a role requirement also needs demonstrated competence — a workplace observation, practical demonstration or supervisor evaluation. Use “Request a competency assessment” on your Competency Profile."],
  ["How is mandatory compliance calculated?", COMPLIANCE_METHOD],
  ["What is Career Development Health?", "Five separate, rule-based dimensions (learning progress, competency readiness, compliance readiness, professional development and career progression). There is no single score. Each dimension explains how its status is derived. It supports conversations with your manager; it is not used for automated employment decisions."],
  ["Who can see my development records?", "You, your line management chain and authorised L&D administrators. Executives see aggregated information only. Access is enforced on the server and audited."],
  ["My CPD target looks wrong.", "Targets come from the CPD policy assigned to you (or none). There is no universal target. Ask L&D to confirm the policy that applies to your role."],
  ["How do I recertify an expired course?", "When a certificate has expired, expires within 90 days, or you are reassigned the course, open the course page and choose “Start recertification”. Your earlier completion remains in your history."],
];

export default async function HelpPage() {
  const { branding } = await getSettings();
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Support" title="Help and Support" description="Answers to common questions about learning records, CPD, competencies and career development." />
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-md border border-line bg-surface px-5 py-3.5">
            <summary className="cursor-pointer font-sans text-sm font-semibold text-ink">{q}</summary>
            <p className="mt-2 text-[0.9375rem] text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel title="Contact Learning &amp; Development">
          <p className="text-[0.9375rem]">Email <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> for course access, record corrections or CPD queries. Include your employee number and the course or claim reference.</p>
        </Panel>
        <Panel title="Accessibility">
          <p className="text-[0.9375rem] text-ink-muted">This platform aims to meet WCAG 2.2 AA. It supports keyboard navigation, screen readers, reduced motion and browser zoom to 200%. Status is always shown with text as well as colour. Report any barrier to the support address and we will provide the content in an accessible alternative.</p>
        </Panel>
      </div>
    </div>
  );
}
