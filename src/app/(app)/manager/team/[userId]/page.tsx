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
import { getI18n } from "@/i18n/server";
import { cancelAssignmentAction, declineCompetencyRequestAction, recordCompetencyAction } from "../../../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Employee Development Review") };
}

export default async function EmployeeReview({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePagePermission("team.view", "reports.org");
  const { t } = await getI18n();
  const { userId } = await params;
  const { tab = "overview" } = await searchParams;
  // Scope check on the server: changing the URL to another employee returns 404.
  if (userId === actor.id || !(await canViewEmployee(actor, userId))) notFound();
  const o = await employeeOverview(userId);
  const canAssess = await canManageEmployee(actor, userId, "competency.assess");
  const base = `/manager/team/${userId}`;
  const tabs = [
    { key: "overview", label: t("Overview"), href: base },
    { key: "learning", label: t("Learning"), href: `${base}?tab=learning` },
    { key: "competency", label: t("Competency"), href: `${base}?tab=competency` },
    { key: "plan", label: t("Development plan"), href: `${base}?tab=plan` },
    { key: "cpd", label: t("CPD"), href: `${base}?tab=cpd` },
  ];
  const p = o.profile;
  return (
    <div>
      <PageHeader
        crumbs={[{ label: t("Manager Dashboard"), href: "/manager" }, { label: t("Team learning"), href: "/manager/team" }, { label: o.user.name }]}
        eyebrow={t("Employee development review · confidential")}
        title={o.user.name}
        meta={<><span>{p?.jobRole?.title}</span><span>{p?.department?.name}</span><span>{p?.location}</span><span>{t("Target: {role}", { role: p?.targetJobRole?.title ?? "—" })}</span></>}
      />
      <TabNav tabs={tabs} current={tab} />

      {tab === "overview" && (
        <div className="space-y-8">
          <MetricRow cols={6}>
            <Metric label={t("Courses completed")} value={o.metrics.coursesCompleted} context={t("{count} this year", { count: o.metrics.coursesCompletedThisYear })} />
            <Metric label={t("In progress")} value={o.metrics.coursesInProgress} />
            <Metric label={t("Mandatory compliance")} value={o.metrics.compliancePercent == null ? "—" : `${o.metrics.compliancePercent}%`} context={o.compliance.overdue ? t("{count} overdue", { count: o.compliance.overdue }) : ""} tone={o.compliance.overdue ? "crit" : undefined} />
            <Metric label={t("Competency coverage")} value={o.metrics.competencyCoverage == null ? "—" : `${o.metrics.competencyCoverage}%`} />
            <Metric label={t("CPD approved")} value={o.metrics.cpdApproved == null ? "—" : fmtNum(o.metrics.cpdApproved)} context={o.metrics.cpdTarget != null ? t("of {target}", { target: o.metrics.cpdTarget }) : ""} />
            <Metric label={t("Webinars attended")} value={o.metrics.webinarsAttended} />
          </MetricRow>
          <Panel title={t("Career Development Health")}><HealthTable dimensions={o.health} computedAt={o.computedAt} /></Panel>
        </div>
      )}

      {tab === "learning" && (
        <div className="space-y-8">
          <Panel title={t("Enrolments")} bodyClassName="pt-0">
            <Table caption={t("Enrolments")}>
              <thead><tr><Th>{t("Course")}</Th><Th>{t("Status")}</Th><Th>{t("Progress")}</Th><Th>{t("Last accessed")}</Th><Th>{t("Completed")}</Th></tr></thead>
              <tbody>{o.courseRows.map((r) => <tr key={r.enrollment.id}><Td className="font-medium">{r.course.title}</Td><Td><Status tone={ENROLLMENT[r.enrollment.status][1]}>{ENROLLMENT[r.enrollment.status][0]}</Status></Td><Td className="w-40"><Progress value={r.percent} label={t("Progress")} /></Td><Td>{fmtDate(r.enrollment.lastAccessedAt)}</Td><Td>{fmtDate(r.enrollment.completedAt)}</Td></tr>)}</tbody>
            </Table>
          </Panel>
          <Panel title={t("Assignments")} bodyClassName="pt-0">
            {o.assignments.length === 0 ? <p className="pt-4 type-meta">{t("No assignments.")}</p> : (
              <Table caption={t("Assignments")}>
                <thead><tr><Th>{t("Learning")}</Th><Th>{t("Type")}</Th><Th>{t("Assigned by")}</Th><Th>{t("Due")}</Th><Th>{t("Status")}</Th><Th /></tr></thead>
                <tbody>{o.assignments.map((a) => { const [l, tone] = MANDATORY[mandatoryState(a, o.computedAt)]; return <tr key={a.id}><Td className="font-medium">{a.course?.title ?? a.path?.title}</Td><Td>{a.isMandatory ? t("Mandatory") : a.kind === "REQUIRED" ? t("Required") : t("Recommended")}</Td><Td>{a.assignedBy.name}</Td><Td>{fmtDate(a.dueDate)}</Td><Td>{a.status === "CANCELLED" ? <Status tone="idle">{t("Cancelled")}</Status> : <Status tone={tone}>{l}</Status>}</Td><Td align="right">{a.status === "ASSIGNED" && !a.isMandatory && <ActionForm action={cancelAssignmentAction} inline><input type="hidden" name="assignmentId" value={a.id} /><SubmitButton size="sm" variant="ghost" confirm={t("Cancel this assignment?")}>{t("Cancel")}</SubmitButton></ActionForm>}</Td></tr>; })}</tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {tab === "competency" && <CompetencyTab userId={userId} o={o} canAssess={canAssess} />}
      {tab === "plan" && <PlanTab userId={userId} actorId={actor.id} />}
      {tab === "cpd" && (
        <Panel title={t("CPD — {period}", { period: o.cpd.period?.name ?? "" })} description={o.cpd.policy ? t("{policy} · target {target}", { policy: o.cpd.policy.name, target: o.cpd.summary?.target ?? t("none") }) : t("No CPD policy assigned")} bodyClassName="pt-0">
          <Table caption={t("CPD claims")}>
            <thead><tr><Th>{t("Activity")}</Th><Th>{t("Date")}</Th><Th align="right">{t("Claimed")}</Th><Th align="right">{t("Approved")}</Th><Th>{t("Status")}</Th></tr></thead>
            <tbody>{o.cpd.claims.map((c) => <tr key={c.id}><Td><Link href={`/cpd/${c.id}`}>{c.activity.title}</Link></Td><Td>{fmtDate(c.activity.activityDate)}</Td><Td align="right">{fmtNum(c.claimedValue.toString())}</Td><Td align="right">{c.approvedValue ? fmtNum(c.approvedValue.toString()) : "—"}</Td><Td><Status tone={CPD_STATUS[c.status][1]}>{CPD_STATUS[c.status][0]}</Status></Td></tr>)}</tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

async function CompetencyTab({ userId, o, canAssess }: { userId: string; o: Awaited<ReturnType<typeof employeeOverview>>; canAssess: boolean }) {
  const { t } = await getI18n();
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
      <Field label={t("Competency")} htmlFor={`c-${requestId ?? "new"}`}><select id={`c-${requestId ?? "new"}`} name="competencyId" defaultValue={competencyId} className="input-base">{comps.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></Field>
      <Field label={t("Assessed level")} htmlFor={`l-${requestId ?? "new"}`}><select id={`l-${requestId ?? "new"}`} name="level" defaultValue={level} className="input-base">{levels.map((l) => <option key={l.id} value={l.level}>{l.level} — {l.name}</option>)}</select></Field>
      <Field label={t("Assessment method")} htmlFor={`m-${requestId ?? "new"}`}><select id={`m-${requestId ?? "new"}`} name="method" className="input-base">{Object.entries(METHOD_LABEL).filter(([k]) => k !== "COURSE_COMPLETION").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label={t("Evidence reference")} htmlFor={`r-${requestId ?? "new"}`}><input id={`r-${requestId ?? "new"}`} name="evidenceReference" className="input-base" placeholder={t("e.g. observation record number")} /></Field>
      <div className="sm:col-span-2"><Field label={t("Evidence assessed")} htmlFor={`e-${requestId ?? "new"}`} required><textarea id={`e-${requestId ?? "new"}`} name="evidenceDescription" rows={2} required className="input-base" /></Field></div>
      <div className="sm:col-span-2"><Field label={t("Assessor notes")} htmlFor={`n-${requestId ?? "new"}`}><textarea id={`n-${requestId ?? "new"}`} name="notes" rows={2} className="input-base" /></Field></div>
      <Field label={t("Evidence file (optional)")} htmlFor={`f-${requestId ?? "new"}`}><input id={`f-${requestId ?? "new"}`} name="file" type="file" className="block font-sans text-sm" /></Field>
      <div className="self-end"><SubmitButton size="sm">{t("Record assessment")}</SubmitButton></div>
    </ActionForm>
  );
  return (
    <div className="space-y-8">
      <Panel title={t("Requirements — {role}", { role: o.profile?.jobRole?.title ?? t("no role") })} bodyClassName="pt-0">
        {o.competency.rows.length ? <CompetencyTable rows={o.competency.rows} /> : <p className="pt-4 type-meta">{t("No requirements configured for this role.")}</p>}
      </Panel>
      {requests.length > 0 && (
        <Panel title={t("Pending assessment requests")}>
          <div className="space-y-6">
            {requests.map((r) => (
              <div key={r.id} className="rounded border border-line p-4">
                <p className="font-sans text-sm font-semibold">{t("{competency} · requested level {level}", { competency: r.competency.name, level: r.requestedLevel })}</p>
                <p className="mt-1 text-[0.9rem]">{r.statement}</p>
                {r.file && <p className="mt-1"><a href={`/api/v1/files/${r.file.id}`}>{r.file.originalName}</a></p>}
                {canAssess && <div className="mt-4 border-t border-line pt-4">{assessForm(r.competencyId, r.id, r.requestedLevel)}</div>}
                {canAssess && (
                  <ActionForm action={declineCompetencyRequestAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <div className="flex-1"><Field label={t("Or close without assessing — reason")} htmlFor={`d-${r.id}`}><input id={`d-${r.id}`} name="note" className="input-base" /></Field></div>
                    <SubmitButton size="sm" variant="secondary">{t("Close request")}</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {canAssess ? (
        <Panel title={t("Record a competency assessment")} description={t("The new assessment supersedes the current one; previous assessments remain in the history and are never overwritten.")}>{assessForm()}</Panel>
      ) : <EmptyState title={t("Assessment not available")}>{t("You can view this record but are not authorised to assess this employee.")}</EmptyState>}
      <Panel title={t("Assessment history")} bodyClassName="pt-0">
        <Table caption={t("Assessment history")}><thead><tr><Th>{t("Date")}</Th><Th>{t("Competency")}</Th><Th>{t("Level")}</Th><Th>{t("Method")}</Th><Th>{t("Assessor")}</Th><Th>{t("Status")}</Th></tr></thead>
          <tbody>{history.map((h) => <tr key={h.id}><Td>{fmtDate(h.assessedAt)}</Td><Td>{h.competency.name}</Td><Td>{h.level}</Td><Td>{METHOD_LABEL[h.method]}</Td><Td>{h.assessor?.name ?? t("System")}</Td><Td>{h.status === "CURRENT" ? <Status tone="ok">{t("Current")}</Status> : <Status tone="idle">{t("Superseded")}</Status>}</Td></tr>)}</tbody>
        </Table>
      </Panel>
      <KeyValue items={[[t("Last assessed"), fmtDate(o.competency.lastAssessedAt)]]} />
    </div>
  );
}

async function PlanTab({ userId, actorId }: { userId: string; actorId: string }) {
  const plan = await prisma.developmentPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!plan) {
    const { t } = await getI18n();
    return <EmptyState title={t("No development plan")}>{t("The employee has not created a development plan yet.")}</EmptyState>;
  }
  const actor = await requirePagePermission("team.view", "reports.org");
  const { plan: detail, role } = await getPlan(actor, plan.id);
  const [competencies, courses] = await Promise.all([
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.course.findMany({ where: { status: "PUBLISHED", ...courseAudienceWhere(await contentAccess(userId)) }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);
  void actorId;
  return <PlanView plan={detail} role={role === "OWNER" ? "VIEWER" : role} competencies={competencies} courses={courses} />;
}
