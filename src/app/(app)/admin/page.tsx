import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { summarizeCompliance } from "@/lib/domain/compliance";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LinkButton, Metric, MetricRow, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { runJobsAction } from "../staff-actions";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const actor = await requirePagePermission("course.manage", "user.manage", "settings.manage");
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
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Administration Dashboard" description="Platform-wide learning operations: content, approvals, compliance and configuration." actions={<><LinkButton href="/admin/courses/new" variant="secondary">New course</LinkButton><LinkButton href="/admin/reports">Reports</LinkButton></>} />
      <MetricRow cols={6}>
        <Metric label="Active users" value={users} context={`${invited} invited`} />
        <Metric label="Published courses" value={published} context={`${drafts} in draft/review`} />
        <Metric label={`Completions ${now.getFullYear()}`} value={completions} definition="Course completions recorded since 1 January." />
        <Metric label="Mandatory compliance" value={comp.ratePercent == null ? "—" : `${comp.ratePercent}%`} context={`${comp.overdue} overdue`} tone={comp.overdue ? "crit" : undefined} definition="Completed mandatory items ÷ items completed or past due, organisation-wide." />
        <Metric label="CPD claims to review" value={cpdQueue} />
        <Metric label="Grading and submissions" value={grading + submissions} context="awaiting instructors" />
      </MetricRow>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel title="Work queues">
          <ul className="divide-y divide-line text-[0.875rem]">
            <li className="flex justify-between py-2 first:pt-0"><Link href="/admin/cpd">CPD claims awaiting review</Link><span className="tabular-nums">{cpdQueue}</span></li>
            <li className="flex justify-between py-2"><Link href="/teaching">Assessments awaiting grading</Link><span className="tabular-nums">{grading}</span></li>
            <li className="flex justify-between py-2"><Link href="/teaching">Practical submissions awaiting review</Link><span className="tabular-nums">{submissions}</span></li>
            <li className="flex justify-between py-2"><Link href="/admin/courses?status=IN_REVIEW">Courses in review</Link><span className="tabular-nums">{drafts}</span></li>
            {webinarsToProcess.map((w) => <li key={w.id} className="flex justify-between py-2"><Link href={`/admin/webinars/${w.id}?tab=attendance`}>Process webinar CPD: {w.title}</Link><span>pending</span></li>)}
          </ul>
        </Panel>
        <Panel title="Scheduled processes" description="Deadline reminders, overdue notices, webinar reminders, certificate expiry and reassessment notices. Repeated runs never duplicate notifications.">
          <p className="text-[0.875rem]">Last run: {lastJob ? `${fmtDate(lastJob.startedAt)} — ${lastJob.status.toLowerCase()}` : "never"}</p>
          {lastJob?.detail && <p className="mt-1 type-meta">{Object.entries(lastJob.detail as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
          <p className="mt-2 type-meta">In production, call POST /api/v1/jobs/run hourly from your scheduler (see deployment guide).</p>
          {can(actor, "settings.manage") && <ActionForm action={runJobsAction} className="mt-3"><SubmitButton size="sm" variant="secondary">Run now</SubmitButton></ActionForm>}
        </Panel>
      </div>
      {can(actor, "audit.view") && (
        <Panel title="Recent administrative activity" className="mt-8" actions={<LinkButton href="/admin/audit" variant="ghost" size="sm">Audit log</LinkButton>} bodyClassName="pt-0">
          <Table caption="Recent audit events"><thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th></tr></thead><tbody>{audits.map((a) => <tr key={a.id}><Td>{fmtDate(a.createdAt)}</Td><Td>{a.actor?.name ?? "System"}</Td><Td className="font-mono text-[0.75rem]">{a.action}</Td><Td>{a.entityType}</Td></tr>)}</tbody></Table>
        </Panel>
      )}
    </div>
  );
}
