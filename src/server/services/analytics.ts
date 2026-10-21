import { activeIntl, tr } from "@/i18n/active";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { summarizeCompliance, mandatoryState } from "@/lib/domain/compliance";
import { evaluateCompetency } from "@/lib/domain/competency";

export interface AnalyticsFilters {
  departmentId?: string;
  businessUnitId?: string;
  jobRoleId?: string;
  location?: string;
  categoryId?: string;
  employmentStatus?: string;
  from: Date;
  to: Date;
}

export interface MetricDef {
  key: string;
  label: string;
  value: number | null;
  display: string;
  definition: string;
}

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));
const fmtPct = (v: number | null) => (v == null ? "—" : `${v}%`);

/**
 * Aggregated learning analytics for a population (a manager's scope or the organisation).
 * All values are computed from persisted records for the stated reporting window.
 * Suitable for the demonstration and mid-size deployments; at very large scale these
 * aggregates should move to SQL views (see docs/ARCHITECTURE.md).
 */
export async function computeAnalytics(scopeUserIds: string[] | null, f: AnalyticsFilters, opts: { minGroupSize?: number } = {}) {
  const now = new Date();
  const userWhere: Prisma.UserWhereInput = {
    status: "ACTIVE",
    ...(scopeUserIds ? { id: { in: scopeUserIds } } : {}),
    profile: {
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.businessUnitId ? { businessUnitId: f.businessUnitId } : {}),
      ...(f.jobRoleId ? { jobRoleId: f.jobRoleId } : {}),
      ...(f.location ? { location: f.location } : {}),
      ...(f.employmentStatus ? { employmentStatus: f.employmentStatus as never } : {}),
    },
  };
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, profile: { select: { departmentId: true, jobRoleId: true, department: { select: { name: true } }, jobRole: { select: { title: true } } } } },
  });
  const ids = users.map((u) => u.id);
  const deptOf = new Map(users.map((u) => [u.id, u.profile?.department?.name ?? tr("Unassigned")]));
  const courseFilter: Prisma.CourseWhereInput = f.categoryId ? { categoryId: f.categoryId } : {};
  const inWindow = { gte: f.from, lte: f.to };

  const [enrollments, completions, assignments, attempts, claims, events, certs, plans, assessments, requirements] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId: { in: ids }, course: courseFilter, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { userId: true, courseId: true, status: true, enrolledAt: true, completedAt: true, timeSpentSeconds: true, lastAccessedAt: true, course: { select: { title: true, code: true, estimatedHours: true } } } }),
    prisma.courseCompletion.findMany({ where: { userId: { in: ids }, course: courseFilter, completedAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } }, select: { userId: true, completedAt: true, courseId: true } }),
    prisma.learningAssignment.findMany({ where: { userId: { in: ids }, status: { not: "CANCELLED" }, ...(f.categoryId ? { course: courseFilter } : {}) }, select: { userId: true, isMandatory: true, kind: true, dueDate: true, completedAt: true, status: true } }),
    prisma.assessmentAttempt.findMany({ where: { userId: { in: ids }, status: "GRADED", submittedAt: inWindow, assessment: { course: courseFilter } }, select: { userId: true, passed: true, percent: true, attemptNumber: true, assessment: { select: { courseId: true, course: { select: { title: true, code: true } } } } } }),
    prisma.cpdClaim.findMany({ where: { userId: { in: ids }, status: "APPROVED", decidedAt: inWindow }, select: { userId: true, approvedValue: true } }),
    prisma.learningActivityEvent.findMany({ where: { userId: { in: ids }, occurredAt: inWindow }, select: { userId: true }, distinct: ["userId"] }),
    prisma.certificate.findMany({ where: { userId: { in: ids }, status: "VALID", expiresAt: { gt: now, lte: new Date(now.getTime() + 60 * 86_400_000) } }, select: { userId: true, expiresAt: true, course: { select: { title: true } }, user: { select: { name: true } } } }),
    prisma.developmentPlan.findMany({ where: { userId: { in: ids } }, select: { userId: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.competencyAssessment.findMany({ where: { userId: { in: ids }, status: "CURRENT" }, select: { userId: true, competencyId: true, level: true, basis: true, assessedAt: true, reassessmentDue: true } }),
    prisma.roleCompetencyRequirement.findMany({ where: { jobRoleId: { in: [...new Set(users.map((u) => u.profile?.jobRoleId).filter(Boolean) as string[])] } }, include: { competency: { include: { domain: { include: { framework: true } } } }, jobRole: true } }),
  ]);

  // Competency coverage
  const assessIdx = new Map(assessments.map((a) => [`${a.userId}:${a.competencyId}`, a]));
  const reqByRole = new Map<string, typeof requirements>();
  for (const r of requirements) reqByRole.set(r.jobRoleId, [...(reqByRole.get(r.jobRoleId) ?? []), r]);
  const gapBuckets = { met: 0, one: 0, two: 0, three: 0, notAssessed: 0 };
  const roleCoverage = new Map<string, { met: number; total: number }>();
  const compGaps = new Map<string, { name: string; gaps: number; notAssessed: number; total: number }>();
  let reqMet = 0;
  let reqTotal = 0;
  for (const u of users) {
    const roleId = u.profile?.jobRoleId;
    if (!roleId) continue;
    for (const r of reqByRole.get(roleId) ?? []) {
      const a = assessIdx.get(`${u.id}:${r.competencyId}`);
      const ev = evaluateCompetency(r.requiredLevel, a ? { level: a.level, basis: a.basis, assessedAt: a.assessedAt, reassessmentDue: a.reassessmentDue } : null, { allowKnowledgeAsCompetence: r.competency.domain.framework.allowCourseCompletionAsCompetence, now });
      reqTotal++;
      const rc = roleCoverage.get(r.jobRole.title) ?? { met: 0, total: 0 };
      rc.total++;
      const cg = compGaps.get(r.competencyId) ?? { name: r.competency.name, gaps: 0, notAssessed: 0, total: 0 };
      cg.total++;
      if (ev.status === "MET") {
        reqMet++;
        rc.met++;
        gapBuckets.met++;
      } else if (ev.status === "NOT_ASSESSED") {
        gapBuckets.notAssessed++;
        cg.notAssessed++;
      } else {
        cg.gaps++;
        if (ev.gap >= 3) gapBuckets.three++;
        else if (ev.gap === 2) gapBuckets.two++;
        else gapBuckets.one++;
      }
      roleCoverage.set(r.jobRole.title, rc);
      compGaps.set(r.competencyId, cg);
    }
  }

  const mandatory = assignments.filter((a) => a.isMandatory);
  const compliance = summarizeCompliance(mandatory, now);
  const windowEnrol = enrollments.filter((e) => e.enrolledAt >= f.from && e.enrolledAt <= f.to);
  const windowCompleted = windowEnrol.filter((e) => e.status === "COMPLETED").length;
  const totalSeconds = enrollments.filter((e) => e.lastAccessedAt && e.lastAccessedAt >= f.from && e.lastAccessedAt <= f.to).reduce((s, e) => s + e.timeSpentSeconds, 0);
  const cpdUsers = new Set(claims.map((c) => c.userId));
  const passed = attempts.filter((a) => a.passed).length;
  const overdueAssignments = assignments.filter((a) => a.kind === "REQUIRED" && mandatoryState(a, now) === "OVERDUE").length;
  const latestPlan = new Map<string, string>();
  for (const p of plans) if (!latestPlan.has(p.userId)) latestPlan.set(p.userId, p.status);

  const metrics: MetricDef[] = [
    { key: "learners", label: tr("Active learners"), value: events.length, display: tr("{n} of {total}", { n: events.length, total: users.length }), definition: tr("Employees with at least one recorded learning activity in the reporting period, out of active employees in scope.") },
    { key: "participation", label: tr("Learning participation"), value: pct(events.length, users.length), display: fmtPct(pct(events.length, users.length)), definition: tr("Active learners ÷ active employees in scope.") },
    { key: "completion", label: tr("Course completion rate"), value: pct(windowCompleted, windowEnrol.length), display: fmtPct(pct(windowCompleted, windowEnrol.length)), definition: tr("Enrolments started in the period that are now completed ÷ all enrolments started in the period.") },
    { key: "compliance", label: tr("Mandatory training compliance"), value: compliance.ratePercent, display: fmtPct(compliance.ratePercent), definition: tr("Completed mandatory items ÷ mandatory items completed or past due (current position, all assignments).") },
    { key: "hours", label: tr("Average learning hours"), value: users.length ? Math.round((totalSeconds / 3600 / users.length) * 10) / 10 : null, display: users.length ? tr("{n} h", { n: (totalSeconds / 3600 / users.length).toFixed(1) }) : "—", definition: tr("Recorded platform learning time on enrolments accessed in the period ÷ employees in scope. Excludes offline and external learning.") },
    { key: "cpd", label: tr("Approved CPD participation"), value: pct(cpdUsers.size, users.length), display: fmtPct(pct(cpdUsers.size, users.length)), definition: tr("Employees with at least one CPD claim approved in the period ÷ employees in scope.") },
    { key: "assessment", label: tr("Assessment success rate"), value: pct(passed, attempts.length), display: fmtPct(pct(passed, attempts.length)), definition: tr("Passed graded attempts ÷ all graded attempts submitted in the period (all attempts, not only first).") },
    { key: "coverage", label: tr("Competency coverage"), value: pct(reqMet, reqTotal), display: fmtPct(pct(reqMet, reqTotal)), definition: tr("Role competency requirements met at the required level (current, unexpired, demonstrated evidence) ÷ all role requirements for employees in scope.") },
    { key: "overdue", label: tr("Overdue learning assignments"), value: overdueAssignments, display: String(overdueAssignments), definition: tr("Required assignments past their due date and not completed (current position).") },
    { key: "expiries", label: tr("Certificate expiries (60 days)"), value: certs.length, display: String(certs.length), definition: tr("Valid certificates expiring within the next 60 days.") },
  ];

  // Department breakdowns
  const deptAgg = new Map<string, { employees: number; hours: number; overdue: number; mandatoryDone: number; mandatoryDue: number; cpdUsers: number; reqMet: number; reqTotal: number }>();
  const dept = (name: string) => {
    if (!deptAgg.has(name)) deptAgg.set(name, { employees: 0, hours: 0, overdue: 0, mandatoryDone: 0, mandatoryDue: 0, cpdUsers: 0, reqMet: 0, reqTotal: 0 });
    return deptAgg.get(name)!;
  };
  for (const u of users) dept(deptOf.get(u.id)!).employees++;
  for (const e of enrollments) if (e.lastAccessedAt && e.lastAccessedAt >= f.from) dept(deptOf.get(e.userId)!).hours += e.timeSpentSeconds / 3600;
  for (const a of mandatory) {
    const st = mandatoryState(a, now);
    const d = dept(deptOf.get(a.userId)!);
    if (st === "COMPLETED") {
      d.mandatoryDone++;
      d.mandatoryDue++;
    } else if (st === "OVERDUE") {
      d.overdue++;
      d.mandatoryDue++;
    }
  }
  for (const uid of cpdUsers) dept(deptOf.get(uid)!).cpdUsers++;
  for (const u of users) {
    const roleId = u.profile?.jobRoleId;
    if (!roleId) continue;
    const d = dept(deptOf.get(u.id)!);
    for (const r of reqByRole.get(roleId) ?? []) {
      const a = assessIdx.get(`${u.id}:${r.competencyId}`);
      const ev = evaluateCompetency(r.requiredLevel, a ? { level: a.level, basis: a.basis, assessedAt: a.assessedAt, reassessmentDue: a.reassessmentDue } : null, { allowKnowledgeAsCompetence: r.competency.domain.framework.allowCourseCompletionAsCompetence, now });
      d.reqTotal++;
      if (ev.status === "MET") d.reqMet++;
    }
  }
  const minGroup = opts.minGroupSize ?? 1;
  const departments = [...deptAgg.entries()]
    .map(([name, d]) => ({
      name,
      employees: d.employees,
      suppressed: d.employees < minGroup,
      hours: Math.round(d.hours * 10) / 10,
      overdue: d.overdue,
      compliance: pct(d.mandatoryDone, d.mandatoryDue),
      cpdParticipation: pct(d.cpdUsers, d.employees),
      coverage: pct(d.reqMet, d.reqTotal),
    }))
    .map((d) => (d.suppressed ? { ...d, hours: 0, overdue: 0, compliance: null, cpdParticipation: null, coverage: null } : d))
    .sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name));

  // Completion trend (12 months)
  const trend: { month: string; completions: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    trend.push({ month: d.toLocaleString(activeIntl(), { month: "short", year: "2-digit" }), completions: completions.filter((c) => c.completedAt >= d && c.completedAt < next).length });
  }

  // Course effectiveness
  const courseAgg = new Map<string, { title: string; code: string; enrolled: number; completed: number; firstAttempts: number; firstPassed: number; scoreSum: number }>();
  for (const e of enrollments) {
    const c = courseAgg.get(e.courseId) ?? { title: e.course.title, code: e.course.code, enrolled: 0, completed: 0, firstAttempts: 0, firstPassed: 0, scoreSum: 0 };
    c.enrolled++;
    if (e.status === "COMPLETED") c.completed++;
    courseAgg.set(e.courseId, c);
  }
  for (const a of attempts) {
    const c = courseAgg.get(a.assessment.courseId);
    if (!c || a.attemptNumber !== 1) continue;
    c.firstAttempts++;
    c.scoreSum += a.percent ?? 0;
    if (a.passed) c.firstPassed++;
  }
  const courses = [...courseAgg.values()]
    .map((c) => ({ ...c, completionRate: pct(c.completed, c.enrolled), firstPassRate: pct(c.firstPassed, c.firstAttempts), avgFirstScore: c.firstAttempts ? Math.round(c.scoreSum / c.firstAttempts) : null }))
    .sort((a, b) => b.enrolled - a.enrolled);

  const planDist: Record<string, number> = { NONE: 0, DRAFT: 0, EMPLOYEE_REVIEW: 0, MANAGER_REVIEW: 0, AGREED: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const u of users) planDist[latestPlan.get(u.id) ?? "NONE"]++;

  const weakestCompetencies = [...compGaps.values()]
    .map((c) => ({ ...c, unmetPercent: pct(c.gaps + c.notAssessed, c.total) ?? 0, notAssessedPercent: pct(c.notAssessed, c.total) ?? 0 }))
    .sort((a, b) => b.unmetPercent - a.unmetPercent)
    .slice(0, 8);

  return {
    population: users.length,
    metrics,
    departments,
    trend,
    roleCoverage: [...roleCoverage.entries()].map(([role, v]) => ({ role, coverage: pct(v.met, v.total) ?? 0, requirements: v.total })).sort((a, b) => a.coverage - b.coverage),
    gapDistribution: [
      { bucket: tr("Met"), count: gapBuckets.met },
      { bucket: tr("1 level"), count: gapBuckets.one },
      { bucket: tr("2 levels"), count: gapBuckets.two },
      { bucket: tr("3+ levels"), count: gapBuckets.three },
      { bucket: tr("Not assessed"), count: gapBuckets.notAssessed },
    ],
    courses,
    planDistribution: planDist,
    weakestCompetencies,
    expiries: certs,
    compliance,
    window: { from: f.from, to: f.to },
  };
}

export function parseAnalyticsFilters(sp: Record<string, string | string[] | undefined>, defaultFrom: Date, defaultTo: Date): AnalyticsFilters {
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const date = (k: string, d: Date) => {
    const v = s(k);
    const parsed = v ? new Date(v) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : d;
  };
  return {
    departmentId: s("department"),
    businessUnitId: s("unit"),
    jobRoleId: s("role"),
    location: s("location"),
    categoryId: s("category"),
    employmentStatus: s("employment"),
    from: date("from", defaultFrom),
    to: date("to", defaultTo),
  };
}
