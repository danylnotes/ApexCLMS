import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { contentAccess, courseAudienceWhere } from "@/server/services/access";
import { canManageEmployee, canViewEmployee } from "@/server/policy";
import { employeeOverview } from "@/server/services/overview";
import { getPlan } from "@/server/services/plans";
import { METHOD_LABEL } from "@/server/services/competency";
import { HealthTable } from "@/components/health";
import { CompetencyTable } from "@/components/competency-table";
import { PlanView } from "@/components/plan-view";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, KeyValue, Metric, MetricRow, PageHeader, Panel, Progress, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { mandatoryState } from "@/lib/domain/compliance";
import { CPD_STATUS, ENROLLMENT, MANDATORY } from "@/lib/status";
import { fmtDate, fmtNum } from "@/lib/format";
import { cancelAssignmentAction, declineCompetencyRequestAction, recordCompetencyAction } from "../../../staff-actions";

export const metadata = { title: "Employee Development Review" };

export default async function EmployeeReview({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePagePermission("team.view", "reports.org");
  const { userId } = await params;
  const { tab = "overview" } = await searchParams;
  // Scope check on the server: changing the URL to another employee returns 404.
  if (userId === actor.id || !(await canViewEmployee(actor, userId))) notFound();
  const o = await employeeOverview(userId);
  const canAssess = await canManageEmployee(actor, userId, "competency.assess");
  const base = `/manager/team/${userId}`;
  const tabs = [
    { key: "overview", label: "Overview", href: base },
    { key: "learning", label: "Learning", href: `${base}?tab=learning` },
    { key: "competency", label: "Competency", href: `${base}?tab=competency` },
    { key: "plan", label: "Development plan", href: `${base}?tab=plan` },
    { key: "cpd", label: "CPD", href: `${base}?tab=cpd` },
  ];
  const p = o.profile;
  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Manager Dashboard", href: "/manager" }, { label: "Team learning", href: "/manager/team" }, { label: o.user.name }]}
        eyebrow="Employee development review · confidential"
        title={o.user.name}
        meta={<><span>{p?.jobRole?.title}</span><span>{p?.department?.name}</span><span>{p?.location}</span><span>Target: {p?.targetJobRole?.title ?? "—"}</span></>}
      />
      <TabNav tabs={tabs} current={tab} />

      {tab === "overview" && (
        <div className="space-y-8">
          <MetricRow cols={6}>
            <Metric label="Courses completed" value={o.metrics.coursesCompleted} context={`${o.metrics.coursesCompletedThisYear} this year`} />
            <Metric label="In progress" value={o.metrics.coursesInProgress} />
            <Metric label="Mandatory compliance" value={o.metrics.compliancePercent == null ? "—" : `${o.metrics.compliancePercent}%`} context={o.compliance.overdue ? `${o.compliance.overdue} overdue` : ""} tone={o.compliance.overdue ? "crit" : undefined} />
            <Metric label="Competency coverage" value={o.metrics.competencyCoverage == null ? "—" : `${o.metrics.competencyCoverage}%`} />
            <Metric label="CPD approved" value={o.metrics.cpdApproved == null ? "—" : fmtNum(o.metrics.cpdApproved)} context={o.metrics.cpdTarget != null ? `of ${o.metrics.cpdTarget}` : ""} />
            <Metric label="Webinars attended" value={o.metrics.webinarsAttended} />
          </MetricRow>
          <Panel title="Career Development Health"><HealthTable dimensions={o.health} computedAt={o.computedAt} /></Panel>
        </div>
      )}

      {tab === "learning" && (
        <div className="space-y-8">
          <Panel title="Enrolments" bodyClassName="pt-0">
            <Table caption="Enrolments">
              <thead><tr><Th>Course</Th><Th>Status</Th><Th>Progress</Th><Th>Last accessed</Th><Th>Completed</Th></tr></thead>
              <tbody>{o.courseRows.map((r) => <tr key={r.enrollment.id}><Td className="font-medium">{r.course.title}</Td><Td><Status tone={ENROLLMENT[r.enrollment.status][1]}>{ENROLLMENT[r.enrollment.status][0]}</Status></Td><Td className="w-40"><Progress value={r.percent} label="Progress" /></Td><Td>{fmtDate(r.enrollment.lastAccessedAt)}</Td><Td>{fmtDate(r.enrollment.completedAt)}</Td></tr>)}</tbody>
            </Table>
          </Panel>
          <Panel title="Assignments" bodyClassName="pt-0">
            {o.assignments.length === 0 ? <p className="pt-4 type-meta">No assignments.</p> : (
              <Table caption="Assignments">
                <thead><tr><Th>Learning</Th><Th>Type</Th><Th>Assigned by</Th><Th>Due</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>{o.assignments.map((a) => { const [l, t] = MANDATORY[mandatoryState(a, o.computedAt)]; return <tr key={a.id}><Td className="font-medium">{a.course?.title ?? a.path?.title}</Td><Td>{a.isMandatory ? "Mandatory" : a.kind === "REQUIRED" ? "Required" : "Recommended"}</Td><Td>{a.assignedBy.name}</Td><Td>{fmtDate(a.dueDate)}</Td><Td>{a.status === "CANCELLED" ? <Status tone="idle">Cancelled</Status> : <Status tone={t}>{l}</Status>}</Td><Td align="right">{a.status === "ASSIGNED" && !a.isMandatory && <ActionForm action={cancelAssignmentAction} inline><input type="hidden" name="assignmentId" value={a.id} /><SubmitButton size="sm" variant="ghost" confirm="Cancel this assignment?">Cancel</SubmitButton></ActionForm>}</Td></tr>; })}</tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {tab === "competency" && <CompetencyTab userId={userId} o={o} canAssess={canAssess} />}
      {tab === "plan" && <PlanTab userId={userId} actorId={actor.id} />}
      {tab === "cpd" && (
        <Panel title={`CPD — ${o.cpd.period?.name ?? ""}`} description={o.cpd.policy ? `${o.cpd.policy.name} · target ${o.cpd.summary?.target ?? "none"}` : "No CPD policy assigned"} bodyClassName="pt-0">
          <Table caption="CPD claims">
            <thead><tr><Th>Activity</Th><Th>Date</Th><Th align="right">Claimed</Th><Th align="right">Approved</Th><Th>Status</Th></tr></thead>
            <tbody>{o.cpd.claims.map((c) => <tr key={c.id}><Td><Link href={`/cpd/${c.id}`}>{c.activity.title}</Link></Td><Td>{fmtDate(c.activity.activityDate)}</Td><Td align="right">{fmtNum(c.claimedValue.toString())}</Td><Td align="right">{c.approvedValue ? fmtNum(c.approvedValue.toString()) : "—"}</Td><Td><Status tone={CPD_STATUS[c.status][1]}>{CPD_STATUS[c.status][0]}</Status></Td></tr>)}</tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

async function CompetencyTab({ userId, o, canAssess }: { userId: string; o: Awaited<ReturnType<typeof employeeOverview>>; canAssess: boolean }) {
  const [requests, comps, levels, history] = await Promise.all([
    prisma.competencyReviewRequest.findMany({ where: { userId, status: "PENDING" }, include: { competency: true, file: { select: { id: true, originalName: true } } } }),
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.proficiencyLevel.findMany({ where: { framework: { status: "ACTIVE" } }, orderBy: { level: "asc" } }),
    prisma.competencyAssessment.findMany({ where: { userId }, orderBy: { assessedAt: "desc" }, take: 15, include: { competency: true, assessor: { select: { name: true } } } }),
  ]);
  const assessForm = (competencyId?: string, requestId?: string, level?: number) => (
    <ActionForm action={recordCompetencyAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <input type="hidden" name="userId" value={userId} />
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      <Field label="Competency" htmlFor={`c-${requestId ?? "new"}`}><select id={`c-${requestId ?? "new"}`} name="competencyId" defaultValue={competencyId} className="input-base">{comps.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></Field>
      <Field label="Assessed level" htmlFor={`l-${requestId ?? "new"}`}><select id={`l-${requestId ?? "new"}`} name="level" defaultValue={level} className="input-base">{levels.map((l) => <option key={l.id} value={l.level}>{l.level} — {l.name}</option>)}</select></Field>
      <Field label="Assessment method" htmlFor={`m-${requestId ?? "new"}`}><select id={`m-${requestId ?? "new"}`} name="method" className="input-base">{Object.entries(METHOD_LABEL).filter(([k]) => k !== "COURSE_COMPLETION").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Evidence reference" htmlFor={`r-${requestId ?? "new"}`}><input id={`r-${requestId ?? "new"}`} name="evidenceReference" className="input-base" placeholder="e.g. observation record number" /></Field>
      <div className="sm:col-span-2"><Field label="Evidence assessed" htmlFor={`e-${requestId ?? "new"}`} required><textarea id={`e-${requestId ?? "new"}`} name="evidenceDescription" rows={2} required className="input-base" /></Field></div>
      <div className="sm:col-span-2"><Field label="Assessor notes" htmlFor={`n-${requestId ?? "new"}`}><textarea id={`n-${requestId ?? "new"}`} name="notes" rows={2} className="input-base" /></Field></div>
      <Field label="Evidence file (optional)" htmlFor={`f-${requestId ?? "new"}`}><input id={`f-${requestId ?? "new"}`} name="file" type="file" className="block font-sans text-sm" /></Field>
      <div className="self-end"><SubmitButton size="sm">Record assessment</SubmitButton></div>
    </ActionForm>
  );
  return (
    <div className="space-y-8">
      <Panel title={`Requirements — ${o.profile?.jobRole?.title ?? "no role"}`} bodyClassName="pt-0">
        {o.competency.rows.length ? <CompetencyTable rows={o.competency.rows} /> : <p className="pt-4 type-meta">No requirements configured for this role.</p>}
      </Panel>
      {requests.length > 0 && (
        <Panel title="Pending assessment requests">
          <div className="space-y-6">
            {requests.map((r) => (
              <div key={r.id} className="rounded border border-line p-4">
                <p className="font-sans text-sm font-semibold">{r.competency.name} · requested level {r.requestedLevel}</p>
                <p className="mt-1 text-[0.9rem]">{r.statement}</p>
                {r.file && <p className="mt-1"><a href={`/api/v1/files/${r.file.id}`}>{r.file.originalName}</a></p>}
                {canAssess && <div className="mt-4 border-t border-line pt-4">{assessForm(r.competencyId, r.id, r.requestedLevel)}</div>}
                {canAssess && (
                  <ActionForm action={declineCompetencyRequestAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <div className="flex-1"><Field label="Or close without assessing — reason" htmlFor={`d-${r.id}`}><input id={`d-${r.id}`} name="note" className="input-base" /></Field></div>
                    <SubmitButton size="sm" variant="secondary">Close request</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {canAssess ? (
        <Panel title="Record a competency assessment" description="The new assessment supersedes the current one; previous assessments remain in the history and are never overwritten.">{assessForm()}</Panel>
      ) : <EmptyState title="Assessment not available">You can view this record but are not authorised to assess this employee.</EmptyState>}
      <Panel title="Assessment history" bodyClassName="pt-0">
        <Table caption="Assessment history"><thead><tr><Th>Date</Th><Th>Competency</Th><Th>Level</Th><Th>Method</Th><Th>Assessor</Th><Th>Status</Th></tr></thead>
          <tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.assessedAt)}</Td><Td>{h.competency.name}</Td><Td>{h.level}</Td><Td>{METHOD_LABEL[h.method]}</Td><Td>{h.assessor?.name ?? "System"}</Td><Td>{h.status === "CURRENT" ? <Status tone="ok">Current</Status> : <Status tone="idle">Superseded</Status>}</Td></tr>)}</tbody>
        </Table>
      </Panel>
      <KeyValue items={[["Last assessed", fmtDate(o.competency.lastAssessedAt)]]} />
    </div>
  );
}

async function PlanTab({ userId, actorId }: { userId: string; actorId: string }) {
  const plan = await prisma.developmentPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!plan) return <EmptyState title="No development plan">The employee has not created a development plan yet.</EmptyState>;
  const actor = await requirePagePermission("team.view", "reports.org");
  const { plan: detail, role } = await getPlan(actor, plan.id);
  const [competencies, courses] = await Promise.all([
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.course.findMany({ where: { status: "PUBLISHED", ...courseAudienceWhere(await contentAccess(userId)) }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);
  void actorId;
  return <PlanView plan={detail} role={role === "OWNER" ? "VIEWER" : role} competencies={competencies} courses={courses} />;
}
