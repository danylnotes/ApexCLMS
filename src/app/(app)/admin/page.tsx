import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { summarizeCompliance } from "@/lib/domain/compliance";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LinkButton, Metric, MetricRow, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { runJobsAction } from "../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Administration") };
}

export default async function AdminHome() {
  const actor = await requirePagePermission("course.manage", "user.manage", "settings.manage");
  const { t } = await getI18n();
  const now = new Date();
  const yStart = new Date(now.getFullYear(), 0, 1);
  const [users, invited, published, drafts, completions, cpdQueue, grading, submissions, mandatory, webinarsToProcess, audits, lastJob] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "INVITED" } }),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.course.count({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } } }),
    prisma.courseCompletion.count({ where: { completedAt: { gte: yStart } } }),
    prisma.cpdClaim.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.assessmentAttempt.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.learningAssignment.findMany({ where: { isMandatory: true, status: { not: "CANCELLED" } }, select: { dueDate: true, completedAt: true } }),
    prisma.webinar.findMany({ where: { cpdEligible: true, attendance: { some: { attended: true, verification: { not: "UNVERIFIED" }, cpdProcessedAt: null } } }, select: { id: true, title: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    prisma.jobRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const comp = summarizeCompliance(mandatory, now);
  const jobStatus: Record<string, string> = { RUNNING: t("running"), SUCCEEDED: t("succeeded"), FAILED: t("failed") };
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Administration Dashboard")} description={t("Platform-wide learning operations: content, approvals, compliance and configuration.")} actions={<><LinkButton href="/admin/courses/new" variant="secondary">{t("New course")}</LinkButton><LinkButton href="/admin/reports">{t("Reports")}</LinkButton></>} />
      <MetricRow cols={6}>
        <Metric label={t("Active users")} value={users} context={t("{count} invited", { count: invited })} />
        <Metric label={t("Published courses")} value={published} context={t("{count} in draft/review", { count: drafts })} />
        <Metric label={t("Completions {year}", { year: now.getFullYear() })} value={completions} definition={t("Course completions recorded since 1 January.")} />
        <Metric label={t("Mandatory compliance")} value={comp.ratePercent == null ? "—" : `${comp.ratePercent}%`} context={t("{count} overdue", { count: comp.overdue })} tone={comp.overdue ? "crit" : undefined} definition={t("Completed mandatory items ÷ items completed or past due, organisation-wide.")} />
        <Metric label={t("CPD claims to review")} value={cpdQueue} />
        <Metric label={t("Grading and submissions")} value={grading + submissions} context={t("awaiting instructors")} />
      </MetricRow>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel title={t("Work queues")}>
          <ul className="divide-y divide-line text-[0.875rem]">
            <li className="flex justify-between py-2 first:pt-0"><Link href="/admin/cpd">{t("CPD claims awaiting review")}</Link><span className="tabular-nums">{cpdQueue}</span></li>
            <li className="flex justify-between py-2"><Link href="/teaching">{t("Assessments awaiting grading")}</Link><span className="tabular-nums">{grading}</span></li>
            <li className="flex justify-between py-2"><Link href="/teaching">{t("Practical submissions awaiting review")}</Link><span className="tabular-nums">{submissions}</span></li>
            <li className="flex justify-between py-2"><Link href="/admin/courses?status=IN_REVIEW">{t("Courses in review")}</Link><span className="tabular-nums">{drafts}</span></li>
            {webinarsToProcess.map((w) => <li key={w.id} className="flex justify-between py-2"><Link href={`/admin/webinars/${w.id}?tab=attendance`}>{t("Process webinar CPD: {title}", { title: w.title })}</Link><span>{t("pending")}</span></li>)}
          </ul>
        </Panel>
        <Panel title={t("Scheduled processes")} description={t("Deadline reminders, overdue notices, webinar reminders, certificate expiry and reassessment notices. Repeated runs never duplicate notifications.")}>
          <p className="text-[0.875rem]">{lastJob ? t("Last run: {date} — {status}", { date: fmtDate(lastJob.startedAt), status: jobStatus[lastJob.status] ?? lastJob.status.toLowerCase() }) : t("Last run: never")}</p>
          {lastJob?.detail && <p className="mt-1 type-meta">{Object.entries(lastJob.detail as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
          <p className="mt-2 type-meta">{t("In production, call {endpoint} hourly from your scheduler (see deployment guide).", { endpoint: "POST /api/v1/jobs/run" })}</p>
          {can(actor, "settings.manage") && <ActionForm action={runJobsAction} className="mt-3"><SubmitButton size="sm" variant="secondary">{t("Run now")}</SubmitButton></ActionForm>}
        </Panel>
      </div>
      {can(actor, "audit.view") && (
        <Panel title={t("Recent administrative activity")} className="mt-8" actions={<LinkButton href="/admin/audit" variant="ghost" size="sm">{t("Audit log")}</LinkButton>} bodyClassName="pt-0">
          <Table caption={t("Recent audit events")}><thead><tr><Th>{t("When")}</Th><Th>{t("Actor")}</Th><Th>{t("Action")}</Th><Th>{t("Entity")}</Th></tr></thead><tbody>{audits.map((a) => <tr key={a.id}><Td>{fmtDate(a.createdAt)}</Td><Td>{a.actor?.name ?? t("System")}</Td><Td className="font-mono text-[0.75rem]">{a.action}</Td><Td>{a.entityType}</Td></tr>)}</tbody></Table>
        </Panel>
      )}
    </div>
  );
}
