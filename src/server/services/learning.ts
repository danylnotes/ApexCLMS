import { Prisma, type Course, type EnrollmentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCanManageCourse, assertCanManageEmployee, can, canManageCourse } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { recordActivity } from "./activity";
import { courseProgress } from "@/lib/domain/progress";
import { evaluateCompletion, type CompletionState } from "@/lib/domain/completion";
import { attemptEligibility, isPass, percentOf, scoreAttempt } from "@/lib/domain/scoring";
import { addMonths } from "@/lib/domain/competency";
import { claimableValue } from "@/lib/domain/cpd";
import { currentPeriod } from "./periods";
import { assertCanAccessCourse, assertCanAccessPath } from "./access";

const SELF_COMPLETABLE = new Set(["TEXT", "VIDEO", "PDF", "DOCUMENT", "EXTERNAL"]);

// ───────────────────────── Enrolment ─────────────────────────

export async function enrol(actor: Actor, courseId: string) {
  if (!can(actor, "learning.self")) throw forbidden();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { prerequisites: { include: { prerequisite: { select: { id: true, title: true } } } } },
  });
  if (!course || course.status !== "PUBLISHED") throw notFound("Course");
  await assertCanAccessCourse(actor.id, course.id);

  const existing = await latestEnrollment(actor.id, courseId);
  if (existing && (existing.status === "ACTIVE" || existing.status === "PENDING_APPROVAL")) return existing; // idempotent
  let cycle = existing?.cycle ?? 1;
  let reuse = !!existing;
  if (existing?.status === "COMPLETED") {
    if (!(await recertificationDue(actor.id, courseId, existing))) return existing;
    cycle = existing.cycle + 1;
    reuse = false;
  }

  if (course.prerequisites.length) {
    const done = await prisma.courseCompletion.findMany({
      where: { userId: actor.id, courseId: { in: course.prerequisites.map((p) => p.prerequisiteId) } },
      select: { courseId: true },
    });
    const doneIds = new Set(done.map((d) => d.courseId));
    const missing = course.prerequisites.filter((p) => !doneIds.has(p.prerequisiteId)).map((p) => p.prerequisite.title);
    if (missing.length) throw invalid(`Complete the prerequisite course${missing.length > 1 ? "s" : ""} first: ${missing.join("; ")}.`);
  }

  const assignment = await prisma.learningAssignment.findFirst({
    where: { userId: actor.id, courseId, status: "ASSIGNED" },
    orderBy: { dueDate: "asc" },
  });
  if (course.enrolmentRule === "ASSIGNED_ONLY" && !assignment) {
    throw forbidden("This course is available by assignment only. Speak to your line manager or L&D.");
  }
  const needsApproval = course.enrolmentRule === "APPROVAL_REQUIRED" && !assignment;
  const status: EnrollmentStatus = needsApproval ? "PENDING_APPROVAL" : "ACTIVE";
  const data = {
    status,
    source: assignment ? ("ASSIGNMENT" as const) : ("SELF" as const),
    dueDate: assignment?.dueDate ?? null,
    enrolledAt: new Date(),
  };

  let enrollment;
  try {
    enrollment = reuse && existing
      ? await prisma.enrollment.update({ where: { id: existing.id }, data })
      : await prisma.enrollment.create({ data: { ...data, userId: actor.id, courseId, cycle } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return (await latestEnrollment(actor.id, courseId))!;
    }
    throw e;
  }

  if (status === "ACTIVE") {
    await recordActivity(actor.id, "ENROLLED", `Enrolled in ${course.title}`, { type: "course", id: course.id });
  } else {
    const managers = await prisma.managerRelationship.findMany({ where: { employeeId: actor.id, type: "LINE", endDate: null } });
    for (const m of managers) {
      await notify(m.managerId, {
        type: "ENROLMENT_DECISION",
        title: "Enrolment approval requested",
        body: `${actor.name} has requested enrolment in ${course.title}.`,
        link: "/manager/assign?tab=requests",
        dedupeKey: `enrol-request:${enrollment.id}:${enrollment.enrolledAt.getTime()}`,
      });
    }
  }
  return enrollment;
}

export async function decideEnrolment(actor: Actor, enrollmentId: string, approve: boolean, note?: string) {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
  if (!e || e.status !== "PENDING_APPROVAL") throw notFound("Enrolment request");
  if (!can(actor, "course.manage")) await assertCanManageEmployee(actor, e.userId, "enrolment.approve");
  const updated = await prisma.enrollment.update({ where: { id: e.id }, data: { status: approve ? "ACTIVE" : "REJECTED" } });
  await audit(actor.id, approve ? "enrolment.approve" : "enrolment.reject", "enrollment", e.id, { courseId: e.courseId, note: note ?? null });
  if (approve) await recordActivity(e.userId, "ENROLLED", `Enrolled in ${e.course.title}`, { type: "course", id: e.courseId });
  await notify(e.userId, {
    type: "ENROLMENT_DECISION",
    title: approve ? "Enrolment approved" : "Enrolment not approved",
    body: approve ? `You can now start ${e.course.title}.` : `Your request to enrol in ${e.course.title} was not approved.${note ? ` Note: ${note}` : ""}`,
    link: `/courses/${e.course.slug}`,
    dedupeKey: `enrol-decision:${e.id}:${e.enrolledAt.getTime()}`,
  });
  return updated;
}

export async function withdraw(actor: Actor, courseId: string) {
  const e = await latestEnrollment(actor.id, courseId);
  if (!e) throw notFound("Enrolment");
  if (e.status === "COMPLETED") throw invalid("Completed courses cannot be withdrawn.");
  const mandatory = await prisma.learningAssignment.count({ where: { userId: actor.id, courseId, status: "ASSIGNED", isMandatory: true } });
  if (mandatory) throw invalid("Mandatory assigned training cannot be withdrawn.");
  return prisma.enrollment.update({ where: { id: e.id }, data: { status: "WITHDRAWN" } });
}

// ───────────────────────── Access helpers ─────────────────────────

/** The most recent enrolment cycle for a learner and course. */
export function latestEnrollment(userId: string, courseId: string, tx: Tx = prisma) {
  return tx.enrollment.findFirst({ where: { userId, courseId }, orderBy: { cycle: "desc" } });
}

/**
 * A completed course may be retaken (new cycle) when its certificate has expired or expires
 * within 90 days, or when a new assignment for it was issued after the completion.
 */
export async function recertificationDue(userId: string, courseId: string, completed: { id: string; completedAt: Date | null }) {
  const completion = await prisma.courseCompletion.findUnique({ where: { enrollmentId: completed.id }, include: { certificate: true } });
  const exp = completion?.certificate?.expiresAt;
  if (exp && exp.getTime() - Date.now() <= 90 * 86_400_000) return true;
  const fresh = await prisma.learningAssignment.count({ where: { userId, courseId, status: "ASSIGNED", createdAt: { gt: completed.completedAt ?? new Date(0) } } });
  return fresh > 0;
}

/** Ensures an assigned learner has an active enrolment (bypassing approval), opening a new cycle when recertifying. */
export async function ensureAssignedEnrollment(userId: string, courseId: string, dueDate: Date | null) {
  const latest = await latestEnrollment(userId, courseId);
  if (!latest) return prisma.enrollment.create({ data: { userId, courseId, status: "ACTIVE", source: "ASSIGNMENT", dueDate } });
  if (latest.status === "COMPLETED") return prisma.enrollment.create({ data: { userId, courseId, cycle: latest.cycle + 1, status: "ACTIVE", source: "ASSIGNMENT", dueDate } });
  return prisma.enrollment.update({ where: { id: latest.id }, data: { status: "ACTIVE", dueDate, source: "ASSIGNMENT" } });
}

async function activeEnrollmentFor(actor: Actor, courseId: string) {
  const e = await prisma.enrollment.findFirst({ where: { userId: actor.id, courseId, status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { cycle: "desc" } });
  if (!e) throw forbidden("Enrol in this course to access its content.");
  return e;
}

async function lessonWithCourse(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  if (!lesson) throw notFound("Lesson");
  return lesson;
}

/** Returns the full player payload. Content is only returned to enrolled learners or course managers. */
export async function getPlayer(actor: Actor, slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: { resources: { include: { file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } } } },
          },
        },
      },
    },
  });
  if (!course) throw notFound("Course");
  const manager = await canManageCourse(actor, course.id);
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: actor.id, courseId: course.id },
    orderBy: { cycle: "desc" },
    include: { lessonProgress: true },
  });
  const enrolled = enrollment && (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED");
  if (!enrolled && !manager) throw forbidden("Enrol in this course to access its content.");
  if (course.status !== "PUBLISHED" && !manager && enrollment?.status !== "COMPLETED") throw notFound("Course");
  return { course, enrollment: enrolled ? enrollment : null, preview: !enrolled && manager };
}

// ───────────────────────── Lesson progress ─────────────────────────

export async function recordLessonView(actor: Actor, lessonId: string, opts: { seconds?: number; videoPosition?: number } = {}) {
  const lesson = await lessonWithCourse(lessonId);
  const e = await activeEnrollmentFor(actor, lesson.module.courseId);
  const seconds = Math.max(0, Math.min(opts.seconds ?? 0, 600)); // cap per heartbeat to limit inflation
  const now = new Date();
  await prisma.$transaction([
    prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: e.id, lessonId } },
      create: { enrollmentId: e.id, lessonId, timeSpentSeconds: seconds, videoPositionSeconds: opts.videoPosition ?? null },
      update: { lastViewedAt: now, timeSpentSeconds: { increment: seconds }, ...(opts.videoPosition != null ? { videoPositionSeconds: Math.floor(opts.videoPosition) } : {}) },
    }),
    prisma.enrollment.update({
      where: { id: e.id },
      data: { lastAccessedAt: now, startedAt: e.startedAt ?? now, timeSpentSeconds: { increment: seconds } },
    }),
  ]);
}

async function markLessonComplete(tx: Tx, enrollmentId: string, lessonId: string, userId: string, title: string) {
  const now = new Date();
  const existing = await tx.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId, lessonId } } });
  if (existing?.completedAt) return false;
  await tx.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: { enrollmentId, lessonId, completedAt: now },
    update: { completedAt: now, lastViewedAt: now },
  });
  await recordActivity(userId, "LESSON_COMPLETED", `Completed lesson: ${title}`, { type: "lesson", id: lessonId }, undefined, tx);
  return true;
}

export async function completeLesson(actor: Actor, lessonId: string) {
  const lesson = await lessonWithCourse(lessonId);
  if (!SELF_COMPLETABLE.has(lesson.type)) throw invalid("This lesson is completed by passing its assessment or by instructor approval.");
  const e = await activeEnrollmentFor(actor, lesson.module.courseId);
  await prisma.$transaction(async (tx) => {
    await markLessonComplete(tx, e.id, lessonId, actor.id, lesson.title);
    await tx.enrollment.update({ where: { id: e.id }, data: { lastAccessedAt: new Date(), startedAt: e.startedAt ?? new Date() } });
  });
  return tryCompleteCourse(e.id);
}

export async function acknowledge(actor: Actor, courseId: string) {
  const e = await activeEnrollmentFor(actor, courseId);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (!course.requireAcknowledgement) throw invalid("This course does not require an acknowledgement.");
  if (!e.acknowledgedAt) await prisma.enrollment.update({ where: { id: e.id }, data: { acknowledgedAt: new Date() } });
  return tryCompleteCourse(e.id);
}

// ───────────────────────── Assessments ─────────────────────────

export const answersSchema = z.array(
  z.object({
    questionId: z.string().min(1),
    selectedOptionId: z.string().nullish(),
    booleanAnswer: z.boolean().nullish(),
    textAnswer: z.string().max(5000).nullish(),
  }),
);

export async function assessmentStatus(userId: string, enrollmentId: string, assessmentId: string, maxAttempts: number) {
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { enrollmentId, assessmentId, userId },
    orderBy: { attemptNumber: "asc" },
  });
  const passed = attempts.some((a) => a.passed);
  const pending = attempts.some((a) => a.status === "PENDING_REVIEW");
  const eligibility = attemptEligibility({ attemptsUsed: attempts.length, maxAttempts, alreadyPassed: passed, pendingReview: pending });
  return { attempts, passed, pending, eligibility };
}

export async function submitAssessment(actor: Actor, assessmentId: string, rawAnswers: unknown) {
  const answers = answersSchema.parse(rawAnswers);
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: true, lesson: true, course: true },
  });
  if (!assessment) throw notFound("Assessment");
  const e = await activeEnrollmentFor(actor, assessment.courseId);
  const validIds = new Set(assessment.questions.map((q) => q.id));
  if (answers.some((a) => !validIds.has(a.questionId))) throw invalid("Answers reference questions outside this assessment.");

  const result = await prisma.$transaction(
    async (tx) => {
      const prior = await tx.assessmentAttempt.findMany({ where: { enrollmentId: e.id, assessmentId } });
      const elig = attemptEligibility({
        attemptsUsed: prior.length,
        maxAttempts: assessment.maxAttempts,
        alreadyPassed: prior.some((a) => a.passed),
        pendingReview: prior.some((a) => a.status === "PENDING_REVIEW"),
      });
      if (!elig.allowed) throw invalid(elig.reason!);
      const scored = scoreAttempt(assessment.questions, answers);
      const passed = scored.percent == null ? null : isPass(scored.percent, assessment.passingScore);
      const byQ = new Map(answers.map((a) => [a.questionId, a]));
      const attempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId,
          enrollmentId: e.id,
          userId: actor.id,
          attemptNumber: prior.length + 1,
          status: scored.needsReview ? "PENDING_REVIEW" : "GRADED",
          submittedAt: new Date(),
          gradedAt: scored.needsReview ? null : new Date(),
          score: scored.needsReview ? null : scored.score,
          maxScore: scored.maxScore,
          percent: scored.percent,
          passed,
          responses: {
            create: scored.responses.map((r) => {
              const a = byQ.get(r.questionId);
              return {
                questionId: r.questionId,
                selectedOptionId: a?.selectedOptionId ?? null,
                booleanAnswer: a?.booleanAnswer ?? null,
                textAnswer: a?.textAnswer ?? null,
                isCorrect: r.isCorrect,
                pointsAwarded: r.pointsAwarded,
              };
            }),
          },
        },
      });
      await tx.enrollment.update({ where: { id: e.id }, data: { lastAccessedAt: new Date() } });
      const label = `${assessment.title} (attempt ${attempt.attemptNumber})`;
      if (scored.needsReview) {
        await recordActivity(actor.id, "ASSESSMENT_SUBMITTED", `Submitted ${label} for review`, { type: "assessment", id: assessmentId }, undefined, tx);
      } else {
        await recordActivity(actor.id, passed ? "ASSESSMENT_PASSED" : "ASSESSMENT_FAILED", `${passed ? "Passed" : "Did not pass"} ${label} — ${scored.percent}%`, { type: "assessment", id: assessmentId }, { percent: scored.percent }, tx);
        if (passed && assessment.lesson) await markLessonComplete(tx, e.id, assessment.lesson.id, actor.id, assessment.lesson.title);
      }
      return attempt;
    },
    { isolationLevel: "Serializable" },
  ).catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
      throw conflict("This attempt has already been submitted.");
    }
    throw err;
  });

  if (result.status === "GRADED") {
    await notify(actor.id, {
      type: "ASSESSMENT_RESULT",
      title: result.passed ? "Assessment passed" : "Assessment result available",
      body: `${assessment.title}: ${result.percent}% (pass mark ${assessment.passingScore}%).`,
      link: `/learn/${assessment.course.slug}`,
      dedupeKey: `attempt:${result.id}`,
    });
  }
  await tryCompleteCourse(e.id);
  return result;
}

export const gradeSchema = z.object({
  attemptId: z.string(),
  grades: z.array(z.object({ responseId: z.string(), points: z.number().int().min(0), feedback: z.string().max(2000).optional() })),
  feedback: z.string().max(4000).optional(),
});

/** Instructor grading of short-answer responses. Grades are final once recorded. */
export async function gradeAttempt(actor: Actor, input: z.infer<typeof gradeSchema>) {
  const { attemptId, grades, feedback } = gradeSchema.parse(input);
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { assessment: { include: { lesson: true, course: true } }, responses: { include: { question: true } } },
  });
  if (!attempt) throw notFound("Attempt");
  await assertCanManageCourse(actor, attempt.assessment.courseId);
  if (attempt.userId === actor.id) throw forbidden("You cannot grade your own attempt.");
  if (attempt.status !== "PENDING_REVIEW") throw conflict("This attempt has already been graded.");
  const gradeMap = new Map(grades.map((g) => [g.responseId, g]));
  for (const r of attempt.responses) {
    if (r.pointsAwarded == null && !gradeMap.has(r.id)) throw invalid("Every short-answer response must be graded.");
    const g = gradeMap.get(r.id);
    if (g && g.points > r.question.points) throw invalid("Points awarded exceed the question value.");
  }
  await prisma.$transaction(async (tx) => {
    let score = 0;
    for (const r of attempt.responses) {
      const g = gradeMap.get(r.id);
      const pts = g ? g.points : r.pointsAwarded ?? 0;
      score += pts;
      if (g) await tx.assessmentResponse.update({ where: { id: r.id }, data: { pointsAwarded: g.points, isCorrect: g.points >= r.question.points, feedback: g.feedback } });
    }
    const percent = percentOf(score, attempt.maxScore ?? 0);
    const passed = isPass(percent, attempt.assessment.passingScore);
    await tx.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { status: "GRADED", score, percent, passed, gradedAt: new Date(), gradedById: actor.id, feedback },
    });
    await recordActivity(attempt.userId, passed ? "ASSESSMENT_PASSED" : "ASSESSMENT_FAILED", `${passed ? "Passed" : "Did not pass"} ${attempt.assessment.title} — ${percent}%`, { type: "assessment", id: attempt.assessmentId }, { percent }, tx);
    if (passed && attempt.assessment.lesson) {
      await markLessonComplete(tx, attempt.enrollmentId, attempt.assessment.lesson.id, attempt.userId, attempt.assessment.lesson.title);
    }
    await audit(actor.id, "assessment.grade", "assessment_attempt", attempt.id, { percent, passed }, tx);
    return percent;
  }).then((percent) =>
    notify(attempt.userId, {
      type: "ASSESSMENT_RESULT",
      title: "Assessment graded",
      body: `${attempt.assessment.title}: ${percent}% (pass mark ${attempt.assessment.passingScore}%).`,
      link: `/learn/${attempt.assessment.course.slug}`,
      dedupeKey: `attempt:${attempt.id}`,
    }),
  );
  return tryCompleteCourse(attempt.enrollmentId);
}

// ───────────────────────── Assignments (practical submissions) ─────────────────────────

export async function submitAssignment(actor: Actor, lessonId: string, body: string, fileId: string | null) {
  const lesson = await lessonWithCourse(lessonId);
  if (lesson.type !== "ASSIGNMENT") throw invalid("This lesson does not accept submissions.");
  const e = await activeEnrollmentFor(actor, lesson.module.courseId);
  if (body.trim().length < 20) throw invalid("Describe your submission in at least 20 characters.");
  const open = await prisma.assignmentSubmission.findFirst({ where: { lessonId, enrollmentId: e.id, status: { in: ["SUBMITTED", "APPROVED"] } } });
  if (open) throw conflict(open.status === "APPROVED" ? "This assignment has already been approved." : "A submission is already awaiting review.");
  const s = await prisma.assignmentSubmission.create({ data: { lessonId, enrollmentId: e.id, userId: actor.id, body: body.trim(), fileId } });
  await prisma.enrollment.update({ where: { id: e.id }, data: { lastAccessedAt: new Date() } });
  return s;
}

export async function reviewSubmission(actor: Actor, submissionId: string, approve: boolean, feedback: string) {
  const s = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, include: { lesson: { include: { module: { include: { course: true } } } } } });
  if (!s) throw notFound("Submission");
  await assertCanManageCourse(actor, s.lesson.module.courseId);
  if (s.userId === actor.id) throw forbidden("You cannot review your own submission.");
  if (s.status !== "SUBMITTED") throw conflict("This submission has already been reviewed.");
  if (!approve && !feedback.trim()) throw invalid("Feedback is required when requesting a revision.");
  await prisma.$transaction(async (tx) => {
    await tx.assignmentSubmission.update({
      where: { id: s.id },
      data: { status: approve ? "APPROVED" : "REVISION_REQUESTED", reviewerId: actor.id, reviewedAt: new Date(), feedback: feedback.trim() || null },
    });
    if (approve) await markLessonComplete(tx, s.enrollmentId, s.lessonId, s.userId, s.lesson.title);
    await audit(actor.id, approve ? "submission.approve" : "submission.revise", "assignment_submission", s.id, undefined, tx);
  });
  await notify(s.userId, {
    type: "ASSESSMENT_RESULT",
    title: approve ? "Assignment approved" : "Assignment revision requested",
    body: `${s.lesson.title} — ${s.lesson.module.course.title}.${feedback ? ` Feedback: ${feedback}` : ""}`,
    link: `/learn/${s.lesson.module.course.slug}?lesson=${s.lessonId}`,
    dedupeKey: `submission:${s.id}`,
  });
  return tryCompleteCourse(s.enrollmentId);
}

// ───────────────────────── Completion & certification ─────────────────────────

export async function completionState(enrollmentId: string, tx: Tx = prisma): Promise<{ course: Course; state: CompletionState; percent: number }> {
  const e = await tx.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: {
      course: { include: { modules: { include: { lessons: true } }, assessments: { where: { isFinal: true } } } },
      lessonProgress: { where: { completedAt: { not: null } } },
      attempts: { where: { passed: true } },
      submissions: { where: { status: "APPROVED" } },
    },
  });
  const lessons = e.course.modules.flatMap((m) => m.lessons);
  const done = new Set(e.lessonProgress.map((p) => p.lessonId));
  const prog = courseProgress(lessons, done);
  const assignmentLessons = lessons.filter((l) => l.type === "ASSIGNMENT" && l.isRequired);
  const approvedLessons = new Set(e.submissions.map((s) => s.lessonId));
  const passedAssessments = new Set(e.attempts.map((a) => a.assessmentId));
  return {
    course: e.course,
    percent: prog.percent,
    state: {
      requiredLessons: prog.total,
      completedRequiredLessons: prog.completed,
      finalAssessments: e.course.assessments.map((a) => ({ id: a.id, passed: passedAssessments.has(a.id) })),
      assignmentLessons: assignmentLessons.length,
      approvedAssignments: assignmentLessons.filter((l) => approvedLessons.has(l.id)).length,
      acknowledged: !!e.acknowledgedAt,
    },
  };
}

function certificateSerial() {
  return `APX-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Evaluates completion rules on the server and, when satisfied, records completion,
 * issues the certificate, closes assignments and raises CPD/competency records — in one transaction.
 * Idempotent: unique constraints on completion (per enrolment) and certificate (per completion).
 */
export async function tryCompleteCourse(enrollmentId: string) {
  const outcome = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.courseCompletion.findUnique({ where: { enrollmentId } });
      if (existing) return { completed: true, newlyCompleted: false, completionId: existing.id };
      const { course, state } = await completionState(enrollmentId, tx);
      const evaluation = evaluateCompletion(course, state);
      if (!evaluation.complete) return { completed: false, newlyCompleted: false, evaluation };
      const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { user: { include: { profile: { include: { cpdPolicy: true } } } } } });
      const userId = enrollment.userId;
      const finals = await tx.assessmentAttempt.findMany({ where: { enrollmentId, passed: true, assessment: { isFinal: true } }, orderBy: { percent: "desc" } });
      const now = new Date();
      const completion = await tx.courseCompletion.create({
        data: { enrollmentId, userId, courseId: course.id, completedAt: now, finalPercent: finals[0]?.percent ?? null, ruleSnapshot: evaluation.checks as unknown as Prisma.InputJsonValue },
      });
      await tx.enrollment.update({ where: { id: enrollmentId }, data: { status: "COMPLETED", completedAt: now } });
      await recordActivity(userId, "COURSE_COMPLETED", `Completed ${course.title}`, { type: "course", id: course.id }, undefined, tx);
      await tx.learningAssignment.updateMany({ where: { userId, courseId: course.id, status: "ASSIGNED" }, data: { status: "COMPLETED", completedAt: now } });

      let certificateId: string | null = null;
      if (course.certificateEnabled) {
        const template = await tx.certificateTemplate.findFirst({ where: { isDefault: true } });
        const cert = await tx.certificate.create({
          data: {
            serial: certificateSerial(),
            userId,
            courseId: course.id,
            completionId: completion.id,
            templateId: template?.id,
            issuedAt: now,
            expiresAt: course.certificateValidityMonths ? addMonths(now, course.certificateValidityMonths) : null,
          },
        });
        certificateId = cert.id;
        await recordActivity(userId, "CERTIFICATE_ISSUED", `Certificate issued: ${course.title}`, { type: "certificate", id: cert.id }, undefined, tx);
      }

      // CPD: only the configured CPD value is claimable, never the estimated study time.
      if (course.cpdEligible && course.cpdValue) {
        const policy = enrollment.user.profile?.cpdPolicy ?? null;
        const period = await currentPeriod(tx);
        const hours = Number(course.cpdValue);
        const value = policy ? claimableValue(hours, { unit: policy.unit, targetPerPeriod: null, pointsPerHour: policy.pointsPerHour ? Number(policy.pointsPerHour) : null, maxPerActivity: policy.maxPerActivity ? Number(policy.maxPerActivity) : null }) : hours;
        const auto = policy?.autoApproveVerifiedInternal ?? false;
        const activity = await tx.cpdActivity.create({
          data: { userId, title: course.title, type: "INTERNAL_COURSE", provider: course.provider, activityDate: now, durationHours: course.cpdValue, description: course.synopsis, courseCompletionId: completion.id },
        });
        const claim = await tx.cpdClaim.create({
          data: {
            activityId: activity.id,
            userId,
            periodId: period?.id,
            unit: policy?.unit ?? course.cpdUnit,
            claimedValue: value,
            approvedValue: auto ? value : null,
            status: auto ? "APPROVED" : "SUBMITTED",
            submittedAt: now,
            decidedAt: auto ? now : null,
            evidence: { create: { description: "Platform-verified course completion record", reference: completion.id } },
          },
        });
        await tx.cpdApproval.create({ data: { claimId: claim.id, actorId: userId, fromStatus: "DRAFT", toStatus: "SUBMITTED", comment: "Raised automatically from verified course completion" } });
        if (auto) await tx.cpdApproval.create({ data: { claimId: claim.id, actorId: userId, fromStatus: "SUBMITTED", toStatus: "APPROVED", value, comment: `Auto-approved under policy "${policy!.name}" (verified internal learning)` } });
      }

      // Competency: record knowledge evidence. It counts as competence only where the framework allows.
      const links = await tx.courseCompetency.findMany({ where: { courseId: course.id }, include: { competency: { include: { domain: { include: { framework: true } } } } } });
      for (const link of links) {
        const current = await tx.competencyAssessment.findFirst({ where: { userId, competencyId: link.competencyId, status: "CURRENT" }, orderBy: { assessedAt: "desc" } });
        if (current && (current.basis === "DEMONSTRATED" || current.level >= link.targetLevel)) continue;
        if (current) {
          await tx.competencyAssessment.update({ where: { id: current.id }, data: { status: "SUPERSEDED" } });
          await tx.competencyAssessmentHistory.create({ data: { assessmentId: current.id, action: "superseded", fromStatus: "CURRENT", toStatus: "SUPERSEDED", note: `Superseded by completion of ${course.code}` } });
        }
        const fw = link.competency.domain.framework;
        const ca = await tx.competencyAssessment.create({
          data: {
            userId,
            competencyId: link.competencyId,
            level: link.targetLevel,
            method: "COURSE_COMPLETION",
            basis: "KNOWLEDGE",
            assessedAt: now,
            notes: fw.allowCourseCompletionAsCompetence
              ? `Recorded from completion of ${course.code}. The ${fw.name} framework accepts course completion as evidence.`
              : `Knowledge acquired through ${course.code}. Workplace demonstration is still required under ${fw.name}.`,
            evidence: { create: { kind: "COURSE_COMPLETION", description: `Course completion: ${course.title}`, reference: completion.id } },
          },
        });
        await tx.competencyAssessmentHistory.create({ data: { assessmentId: ca.id, action: "created", toStatus: "CURRENT", note: "From course completion" } });
      }
      return { completed: true, newlyCompleted: true, completionId: completion.id, certificateId, userId, course };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  ).catch(async (err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
      const c = await prisma.courseCompletion.findUnique({ where: { enrollmentId } });
      if (c) return { completed: true, newlyCompleted: false, completionId: c.id };
    }
    throw err;
  });

  if (outcome.newlyCompleted && "course" in outcome && outcome.course && outcome.userId) {
    await notify(outcome.userId, {
      type: "COURSE_COMPLETED",
      title: "Course completed",
      body: `You have completed ${outcome.course.title}.`,
      link: `/courses/${outcome.course.slug}`,
      dedupeKey: `completion:${outcome.completionId}`,
    });
    if (outcome.certificateId) {
      await notify(outcome.userId, {
        type: "CERTIFICATE_ISSUED",
        title: "Certificate issued",
        body: `Your certificate for ${outcome.course.title} is available.`,
        link: `/certificates`,
        dedupeKey: `certificate:${outcome.certificateId}`,
      });
    }
    await updatePathCompletion(outcome.userId);
  }
  return outcome;
}

async function updatePathCompletion(userId: string) {
  const enrolments = await prisma.learningPathEnrollment.findMany({ where: { userId, completedAt: null }, include: { path: { include: { items: true } } } });
  if (!enrolments.length) return;
  const done = new Set((await prisma.courseCompletion.findMany({ where: { userId }, select: { courseId: true } })).map((c) => c.courseId));
  for (const pe of enrolments) {
    const required = pe.path.items.filter((i) => i.isRequired);
    if (required.length && required.every((i) => done.has(i.courseId))) {
      await prisma.learningPathEnrollment.update({ where: { id: pe.id }, data: { completedAt: new Date() } });
      await prisma.learningAssignment.updateMany({ where: { userId, pathId: pe.pathId, status: "ASSIGNED" }, data: { status: "COMPLETED", completedAt: new Date() } });
    }
  }
}

export async function startLearningPath(actor: Actor, pathId: string) {
  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path || path.status !== "PUBLISHED") throw notFound("Learning path");
  await assertCanAccessPath(actor.id, path);
  const pe = await prisma.learningPathEnrollment.upsert({ where: { pathId_userId: { pathId, userId: actor.id } }, create: { pathId, userId: actor.id }, update: {} });
  await recordActivity(actor.id, "PATH_STARTED", `Started learning path: ${path.title}`, { type: "learning_path", id: path.id });
  return pe;
}
