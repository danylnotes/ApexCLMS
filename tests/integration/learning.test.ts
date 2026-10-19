import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as learning from "@/server/services/learning";
import { actor, correctAnswers, course, freshEmployee, wrongAnswers } from "./helpers";

describe("enrolment", () => {
  it("is idempotent", async () => {
    const me = await freshEmployee();
    const c = await course("HSE-110");
    const a = await learning.enrol(me, c.id);
    const b = await learning.enrol(me, c.id);
    expect(a.id).toBe(b.id);
    expect(await prisma.enrollment.count({ where: { userId: me.id, courseId: c.id } })).toBe(1);
  });

  it("enforces prerequisites", async () => {
    const me = await freshEmployee();
    const c = await course("OPX-210");
    await expect(learning.enrol(me, c.id)).rejects.toThrow(/prerequisite/i);
  });

  it("routes approval-required courses to the line manager", async () => {
    const me = await freshEmployee({ managerEmail: "omar.haddad@apex-demo.test" });
    const c = await course("LSS-300");
    const e = await learning.enrol(me, c.id);
    expect(e.status).toBe("PENDING_APPROVAL");
    const omar = await actor("omar.haddad@apex-demo.test");
    expect(await prisma.notification.count({ where: { userId: omar.id, type: "ENROLMENT_DECISION" } })).toBeGreaterThan(0);
    // A manager outside the reporting line cannot decide
    const tomasz = await actor("tomasz.nowak@apex-demo.test");
    await expect(learning.decideEnrolment(tomasz, e.id, true)).rejects.toThrow(/scope/);
    const approved = await learning.decideEnrolment(omar, e.id, true);
    expect(approved.status).toBe("ACTIVE");
  });

  it("does not expose content to learners who are not enrolled", async () => {
    const me = await freshEmployee();
    const c = await course("PSM-101");
    await expect(learning.getPlayer(me, c.slug)).rejects.toThrow(/Enrol/);
    await expect(learning.completeLesson(me, c.modules[0].lessons[0].id)).rejects.toThrow(/Enrol/);
  });
});

describe("progress, assessment, completion and certification", () => {
  it("persists progress, scores attempts and completes the course exactly once", async () => {
    const me = await freshEmployee({ policy: "Engineering Professional Registration" });
    const c = await course("PSM-101");
    await learning.enrol(me, c.id);
    const lessons = c.modules.sort((a, b) => a.sortOrder - b.sortOrder).flatMap((m) => m.lessons.sort((a, b) => a.sortOrder - b.sortOrder));
    const reading = lessons.filter((l) => l.type !== "ASSESSMENT");
    const assessmentLesson = lessons.find((l) => l.type === "ASSESSMENT")!;

    // Assessment lessons cannot be marked complete directly
    await expect(learning.completeLesson(me, assessmentLesson.id)).rejects.toThrow(/assessment/);

    await learning.recordLessonView(me, reading[0].id, { seconds: 120 });
    for (const l of reading) await learning.completeLesson(me, l.id);
    await learning.completeLesson(me, reading[0].id); // repeat is a no-op
    const enrollment = await prisma.enrollment.findFirstOrThrow({ where: { userId: me.id, courseId: c.id }, include: { lessonProgress: true } });
    expect(enrollment.lessonProgress.filter((p) => p.completedAt)).toHaveLength(reading.length);
    expect(enrollment.timeSpentSeconds).toBeGreaterThanOrEqual(120);
    expect(enrollment.status).toBe("ACTIVE"); // assessment still required

    const assessmentId = c.assessments[0].id;
    const fail = await learning.submitAssessment(me, assessmentId, await wrongAnswers(assessmentId));
    expect(fail.passed).toBe(false);
    expect(await prisma.certificate.count({ where: { userId: me.id } })).toBe(0);

    const pass = await learning.submitAssessment(me, assessmentId, await correctAnswers(assessmentId));
    expect(pass).toMatchObject({ passed: true, percent: 100, attemptNumber: 2 });
    await expect(learning.submitAssessment(me, assessmentId, await correctAnswers(assessmentId))).rejects.toThrow(/already passed/);

    const done = await prisma.enrollment.findFirstOrThrow({ where: { userId: me.id, courseId: c.id }, include: { completion: { include: { certificate: true } } } });
    expect(done.status).toBe("COMPLETED");
    expect(done.completion?.certificate?.serial).toMatch(/^APX-/);
    expect(done.completion?.certificate?.expiresAt).toBeTruthy(); // 36-month validity

    // Idempotent completion: re-evaluating never creates a second completion or certificate
    await Promise.all([learning.tryCompleteCourse(done.id), learning.tryCompleteCourse(done.id)]);
    expect(await prisma.courseCompletion.count({ where: { enrollmentId: done.id } })).toBe(1);
    expect(await prisma.certificate.count({ where: { userId: me.id, courseId: c.id } })).toBe(1);

    // CPD raised for review at the configured value (not auto-approved under this policy)
    const claim = await prisma.cpdClaim.findFirstOrThrow({ where: { userId: me.id, activity: { courseCompletion: { courseId: c.id } } } });
    expect(claim.status).toBe("SUBMITTED");
    expect(Number(claim.claimedValue)).toBe(6);

    // Competency evidence recorded as knowledge only
    const ca = await prisma.competencyAssessment.findMany({ where: { userId: me.id } });
    expect(ca.length).toBeGreaterThan(0);
    expect(ca.every((a) => a.basis === "KNOWLEDGE" && a.method === "COURSE_COMPLETION")).toBe(true);

    // Learning history and notifications reflect the outcome
    expect(await prisma.learningActivityEvent.count({ where: { userId: me.id, type: "COURSE_COMPLETED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: me.id, type: "CERTIFICATE_ISSUED" } })).toBe(1);
  });

  it("enforces the maximum number of attempts", async () => {
    const me = await freshEmployee();
    const c = await course("LSS-110");
    await learning.enrol(me, c.id);
    const id = c.assessments[0].id;
    for (let i = 0; i < c.assessments[0].maxAttempts; i++) await learning.submitAssessment(me, id, await wrongAnswers(id));
    await expect(learning.submitAssessment(me, id, await correctAnswers(id))).rejects.toThrow(/maximum/);
  });

  it("holds short-answer attempts for instructor grading", async () => {
    const yusuf = await actor("yusuf.kareem@apex-demo.test");
    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({ where: { userId: yusuf.id, status: "PENDING_REVIEW" }, include: { responses: { include: { question: true } }, assessment: true } });
    const shortAnswer = attempt.responses.find((r) => r.question.type === "SHORT_ANSWER")!;
    const outsider = await actor("graham.whitfield@apex-demo.test"); // instructor, but not on OPX-210
    await expect(learning.gradeAttempt(outsider, { attemptId: attempt.id, grades: [{ responseId: shortAnswer.id, points: 2 }] })).rejects.toThrow(/not authorised/);
    const omar = await actor("omar.haddad@apex-demo.test");
    await expect(learning.gradeAttempt(omar, { attemptId: attempt.id, grades: [{ responseId: shortAnswer.id, points: 5 }] })).rejects.toThrow(/exceed/);
    await learning.gradeAttempt(omar, { attemptId: attempt.id, grades: [{ responseId: shortAnswer.id, points: 2, feedback: "Clear verification method." }] });
    const graded = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(graded).toMatchObject({ status: "GRADED", passed: true, percent: 100 });
    await expect(learning.gradeAttempt(omar, { attemptId: attempt.id, grades: [] })).rejects.toThrow(/already been graded/);
  });

  it("requires instructor approval for practical assignments", async () => {
    const aisha = await actor("aisha.rahman@apex-demo.test");
    const sub = await prisma.assignmentSubmission.findFirstOrThrow({ where: { userId: aisha.id, status: "SUBMITTED" } });
    const omar = await actor("omar.haddad@apex-demo.test");
    await expect(learning.reviewSubmission(omar, sub.id, false, "")).rejects.toThrow(/Feedback is required/);
    await learning.reviewSubmission(omar, sub.id, true, "Good rounds log.");
    // OPS-150 also needs its knowledge check passed before completion
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { id: sub.enrollmentId } });
    expect(e.status).toBe("ACTIVE");
    const c = await course("OPS-150");
    await learning.submitAssessment(aisha, c.assessments[0].id, await correctAnswers(c.assessments[0].id));
    const after = await prisma.enrollment.findUniqueOrThrow({ where: { id: sub.enrollmentId } });
    expect(after.status).toBe("COMPLETED");
  });

  it("opens a recertification cycle only when the certificate is expiring or reassigned", async () => {
    const daniel = await actor("daniel.reyes@apex-demo.test");
    const c = await course("PSM-101");
    const before = await learning.latestEnrollment(daniel.id, c.id);
    const again = await learning.enrol(daniel, c.id); // valid certificate, no new assignment
    expect(again.id).toBe(before!.id);
    const h2s = await course("HSE-110");
    const latest = await learning.latestEnrollment(daniel.id, h2s.id);
    expect(latest!.cycle).toBe(2); // recertification cycle created for the expired certificate
    expect(await prisma.courseCompletion.count({ where: { userId: daniel.id, courseId: h2s.id } })).toBe(1); // history kept
  });
});
