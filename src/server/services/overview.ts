import { prisma } from "../db";
import { getSettings } from "../settings";
import { courseProgress, remainingMinutes } from "@/lib/domain/progress";
import { mandatoryState, summarizeCompliance } from "@/lib/domain/compliance";
import { evaluateHealth, type HealthInputs } from "@/lib/domain/health";
import { buildProfile } from "./competency";
import { cpdWorkspace } from "./cpd";
import { tr } from "@/i18n/active";
import { fmtDate, fmtDateTime } from "@/lib/format";

/**
 * Assembles an individual's development overview from persisted records.
 * Callers must have authorised access to `userId` (see policy.assertCanViewEmployee).
 */
export async function employeeOverview(userId: string, now = new Date()) {
  const settings = await getSettings();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [user, enrollments, assignments, completions, attendance, certificates, credentials, pathEnrolments, plan, lastEvent, registrations] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: { include: { jobRole: true, targetJobRole: true, department: true, businessUnit: true, cpdPolicy: true } } },
    }),
    prisma.enrollment.findMany({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED", "PENDING_APPROVAL"] } },
      include: {
        course: { include: { category: true, instructors: { include: { user: { select: { name: true } } } }, modules: { include: { lessons: { select: { id: true, isRequired: true, durationMinutes: true } } } } } },
        lessonProgress: { where: { completedAt: { not: null } }, select: { lessonId: true } },
      },
    }),
    prisma.learningAssignment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      include: { course: { select: { id: true, title: true, slug: true, code: true } }, path: { select: { id: true, title: true, slug: true } }, assignedBy: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.courseCompletion.findMany({ where: { userId }, select: { id: true, completedAt: true, courseId: true } }),
    prisma.webinarAttendance.findMany({ where: { userId, attended: true }, select: { recordedAt: true, verification: true, webinar: { select: { startsAt: true } } } }),
    prisma.certificate.findMany({ where: { userId }, include: { course: { select: { title: true, slug: true } } } }),
    prisma.credential.findMany({ where: { userId } }),
    prisma.learningPathEnrollment.findMany({ where: { userId }, include: { path: { include: { items: { include: { course: { select: { id: true, title: true, slug: true } } }, orderBy: { sortOrder: "asc" } } } } } }),
    prisma.developmentPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { objectives: true } }),
    prisma.learningActivityEvent.findFirst({ where: { userId }, orderBy: { occurredAt: "desc" } }),
    prisma.webinarRegistration.findMany({
      where: { userId, status: { in: ["REGISTERED", "WAITLISTED"] }, webinar: { startsAt: { gt: now }, status: "SCHEDULED" } },
      include: { webinar: true },
      orderBy: { webinar: { startsAt: "asc" } },
      take: 5,
    }),
  ]);
  const profile = user.profile;

  // Course progress
  const courseRows = enrollments.map((e) => {
    const lessons = e.course.modules.flatMap((m) => m.lessons);
    const done = e.lessonProgress.map((p) => p.lessonId);
    const prog = courseProgress(lessons, done);
    return {
      enrollment: e,
      course: e.course,
      percent: e.status === "COMPLETED" ? 100 : prog.percent,
      completedLessons: prog.completed,
      totalLessons: prog.total,
      remainingMinutes: e.status === "COMPLETED" ? 0 : remainingMinutes(lessons, done),
    };
  });
  const active = courseRows.filter((r) => r.enrollment.status === "ACTIVE");
  const completedSet = new Set(completions.map((c) => c.courseId));
  const continueLearning = [...active].sort((a, b) => {
    const ad = a.enrollment.dueDate?.getTime() ?? Infinity;
    const bd = b.enrollment.dueDate?.getTime() ?? Infinity;
    const soon = (d: number) => d - now.getTime() < 30 * 86_400_000;
    if (soon(ad) !== soon(bd)) return soon(ad) ? -1 : 1;
    return (b.enrollment.lastAccessedAt?.getTime() ?? 0) - (a.enrollment.lastAccessedAt?.getTime() ?? 0);
  });

  // Assignments & compliance
  const mandatory = assignments.filter((a) => a.isMandatory);
  const compliance = summarizeCompliance(mandatory.map((a) => ({ dueDate: a.dueDate, completedAt: a.completedAt })), now, settings.learning.mandatoryDueSoonDays);
  const required = assignments.filter((a) => a.kind === "REQUIRED");
  const requiredOverdue = required.filter((a) => mandatoryState(a, now) === "OVERDUE").length;
  const expDays = settings.health.expiringDays * 86_400_000;
  const validCerts = certificates.filter((c) => c.status === "VALID" && (!c.expiresAt || c.expiresAt > now));
  const expiringSoon = validCerts.filter((c) => c.expiresAt && c.expiresAt.getTime() - now.getTime() <= expDays).length;
  // Expired certificates only matter while there is no newer valid one for the same course.
  const expiredCerts = certificates.filter((c) => c.status === "VALID" && c.expiresAt && c.expiresAt <= now && !validCerts.some((v) => v.courseId === c.courseId)).length;
  const overdueReassessments = await prisma.competencyAssessment.count({ where: { userId, status: "CURRENT", reassessmentDue: { lt: now } } });

  // Paths
  const paths = pathEnrolments.map((pe) => {
    const req = pe.path.items.filter((i) => i.isRequired);
    const done = req.filter((i) => completedSet.has(i.courseId)).length;
    const next = pe.path.items.find((i) => !completedSet.has(i.courseId) && (!i.prerequisiteItemId || completedSet.has(pe.path.items.find((x) => x.id === i.prerequisiteItemId)?.courseId ?? "")));
    return { enrolment: pe, path: pe.path, percent: req.length ? Math.round((done / req.length) * 100) : 0, done, total: req.length, next: next?.course ?? null };
  });

  // Competency and CPD
  const [competency, target, cpd] = await Promise.all([
    buildProfile(userId, profile?.jobRoleId ?? null, now),
    profile?.targetJobRoleId ? buildProfile(userId, profile.targetJobRoleId, now) : Promise.resolve(null),
    cpdWorkspace(userId),
  ]);

  const webinarsAttended = attendance.length;
  const webinarsAttendedThisYear = attendance.filter((a) => a.webinar.startsAt >= yearStart).length;
  const completedThisYear = completions.filter((c) => c.completedAt >= yearStart).length;
  const overallPercent = courseRows.length ? Math.round(courseRows.reduce((s, r) => s + r.percent, 0) / courseRows.length) : null;

  const objectivesOverdue = plan?.objectives.filter((o) => o.status !== "COMPLETED" && o.status !== "DEFERRED" && o.targetDate && o.targetDate < now).length ?? 0;
  const healthInputs: HealthInputs = {
    now,
    learning: {
      assignedTotal: required.length,
      assignedCompleted: required.filter((a) => a.status === "COMPLETED").length,
      assignedOverdue: requiredOverdue,
      activeEnrollments: active.length,
      lastActivityAt: lastEvent?.occurredAt ?? null,
      paths: paths.map((p) => ({ title: p.path.title, percent: p.percent })),
    },
    competency: { hasRoleRequirements: competency.rows.length > 0, roleTitle: profile?.jobRole?.title ?? null, summary: competency.rows.length ? competency.summary : null, lastAssessedAt: competency.lastAssessedAt },
    professional: {
      hasPolicy: !!cpd.policy,
      policyName: cpd.policy?.name ?? null,
      unit: cpd.policy?.unit ?? "HOURS",
      cpd: cpd.summary,
      validCertificates: validCerts.length,
      verifiedCredentials: credentials.filter((c) => c.verifiedAt && (!c.expiresOn || c.expiresOn > now)).length,
    },
    compliance: { ...compliance, expiringSoon, expired: expiredCerts, overdueReassessments },
    career: {
      targetRoleTitle: profile?.targetJobRole?.title ?? null,
      targetSummary: target?.rows.length ? target.summary : null,
      plan: plan
        ? { status: plan.status, lastReviewedAt: plan.lastReviewedAt, objectivesTotal: plan.objectives.length, objectivesCompleted: plan.objectives.filter((o) => o.status === "COMPLETED").length, objectivesOverdue }
        : null,
    },
  };
  const health = evaluateHealth(healthInputs, settings.health);

  return {
    user,
    profile,
    courseRows,
    continueLearning,
    assignments,
    mandatory,
    compliance,
    paths,
    competency,
    target,
    cpd,
    certificates,
    credentials,
    plan,
    registrations,
    health,
    healthInputs,
    metrics: {
      overallPercent,
      coursesCompleted: completions.length,
      coursesCompletedThisYear: completedThisYear,
      coursesInProgress: active.length,
      webinarsAttended,
      webinarsAttendedThisYear,
      cpdApproved: cpd.summary?.approved ?? null,
      cpdTarget: cpd.summary?.target ?? null,
      cpdUnit: cpd.policy?.unit ?? "HOURS",
      compliancePercent: compliance.ratePercent,
      competencyCoverage: competency.rows.length ? competency.summary.coveragePercent : null,
    },
    computedAt: now,
  };
}

export type EmployeeOverview = Awaited<ReturnType<typeof employeeOverview>>;

/** Prioritised development actions derived from real requirements and gaps. */
export function developmentPriorities(o: EmployeeOverview) {
  const items: { rank: number; title: string; reason: string; href: string; tone: "crit" | "warn" | "info" }[] = [];
  const now = o.computedAt;
  for (const a of o.mandatory) {
    const st = mandatoryState(a, now);
    if (st === "OVERDUE" && a.course) items.push({ rank: 0, title: tr("Complete overdue mandatory training: {course}", { course: a.course.title }), reason: tr("Due {date}", { date: fmtDate(a.dueDate) }), href: `/courses/${a.course.slug}`, tone: "crit" });
    else if (st === "DUE_SOON" && a.course) items.push({ rank: 1, title: tr("Complete mandatory training: {course}", { course: a.course.title }), reason: tr("Due {date}", { date: fmtDate(a.dueDate) }), href: `/courses/${a.course.slug}`, tone: "warn" });
  }
  for (const r of o.continueLearning.slice(0, 2)) {
    if (r.percent > 0 && r.percent < 100) items.push({ rank: 2, title: tr("Finish the remaining lessons in {course}", { course: r.course.title }), reason: tr("{completed} of {total} required lessons completed", { completed: r.completedLessons, total: r.totalLessons }), href: `/learn/${r.course.slug}`, tone: "info" });
  }
  for (const row of o.competency.rows.filter((r) => r.evaluation && r.evaluation.gap > 0).slice(0, 2)) {
    const e = row.evaluation!;
    if (e.knowledgeOnly) items.push({ rank: 3, title: tr("Request a workplace assessment for {competency}", { competency: row.competency.name }), reason: tr("Knowledge evidence recorded; demonstration not yet assessed"), href: "/competencies", tone: "warn" });
    else if (e.status === "EXPIRED") items.push({ rank: 2, title: tr("Arrange reassessment: {competency}", { competency: row.competency.name }), reason: tr("Reassessment date has passed"), href: "/competencies", tone: "crit" });
    else if (row.recommended[0]) items.push({ rank: 3, title: tr("Develop {competency}: {course}", { competency: row.competency.name, course: row.recommended[0].title }), reason: tr("Gap of {count, plural, one {# level} other {# levels}} to role requirement", { count: e.gap }), href: `/courses/${row.recommended[0].slug}`, tone: "warn" });
  }
  for (const r of o.registrations.slice(0, 1)) {
    items.push({ rank: 4, title: tr("Attend: {webinar}", { webinar: r.webinar.title }), reason: fmtDateTime(r.webinar.startsAt), href: `/webinars/${r.webinar.slug}`, tone: "info" });
  }
  for (const p of o.paths) if (p.next && p.percent < 100) items.push({ rank: 4, title: tr("Next on {path}: {course}", { path: p.path.title, course: p.next.title }), reason: tr("{completed} of {total} required courses completed", { completed: p.done, total: p.total }), href: `/courses/${p.next.slug}`, tone: "info" });
  const career = o.health.find((h) => h.key === "career");
  if (career && career.status !== "ON_TRACK" && career.nextAction) items.push({ rank: 5, title: career.nextAction.label, reason: career.gaps[0] ?? tr("Career development"), href: career.nextAction.href, tone: "info" });
  return items.sort((a, b) => a.rank - b.rank).slice(0, 7);
}
