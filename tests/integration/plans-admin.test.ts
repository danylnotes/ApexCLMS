import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as plans from "@/server/services/plans";
import * as ac from "@/server/services/admin-courses";
import * as learning from "@/server/services/learning";
import { assignLearning } from "@/server/services/assignments";
import { importUsersCsv } from "@/server/services/admin-org";
import { runScheduledJobs } from "@/server/services/jobs";
import { actor, freshEmployee } from "./helpers";

describe("individual development plans", () => {
  it("moves through employee and manager review with history", async () => {
    const me = await freshEmployee({ managerEmail: "omar.haddad@apex-demo.test" });
    const omar = await actor("omar.haddad@apex-demo.test");
    const plan = await plans.createPlan(me, { title: "2026 plan", careerAspiration: "Senior operator", targetJobRoleId: null });
    expect(plan.reviewerId).toBe(omar.id);
    await expect(plans.createPlan(me, { title: "Second" })).rejects.toThrow(/open development plan/);
    await expect(plans.transitionPlan(me, plan.id, "EMPLOYEE_REVIEW")).resolves.toBeUndefined();
    await expect(plans.transitionPlan(me, plan.id, "MANAGER_REVIEW")).rejects.toThrow(/objective/);
    await plans.upsertObjective(me, plan.id, null, { goal: "Lead a shift handover", learningModel: "EXPERIENTIAL" });
    await plans.transitionPlan(me, plan.id, "MANAGER_REVIEW");
    await expect(plans.upsertObjective(me, plan.id, null, { goal: "Sneak in a goal" })).rejects.toThrow(/cannot be changed/);
    await expect(plans.transitionPlan(me, plan.id, "AGREED")).rejects.toThrow(/manager/);
    const tomasz = await actor("tomasz.nowak@apex-demo.test"); // not in this employee's line
    await expect(plans.transitionPlan(tomasz, plan.id, "AGREED")).rejects.toThrow(/not found/);
    await expect(plans.transitionPlan(omar, plan.id, "DRAFT", "")).rejects.toThrow(/comment/);
    await plans.transitionPlan(omar, plan.id, "AGREED", "Agreed — good focus.");
    await plans.transitionPlan(me, plan.id, "IN_PROGRESS");
    const { plan: p } = await plans.getPlan(omar, plan.id);
    expect(p.status).toBe("IN_PROGRESS");
    expect(p.agreedAt).toBeTruthy();
    expect(p.reviews.map((r) => r.toStatus)).toEqual(["IN_PROGRESS", "AGREED", "MANAGER_REVIEW", "EMPLOYEE_REVIEW"]);
    expect(await prisma.notification.count({ where: { userId: me.id, type: "PLAN_REVIEW" } })).toBeGreaterThan(0);
  });
});

describe("course administration", () => {
  it("creates, builds, publishes and assigns a course that learners can then complete", async () => {
    const helen = await actor("helen.mercer@apex-demo.test");
    const category = await prisma.courseCategory.findFirstOrThrow();
    const code = `IT-${Date.now() % 100000}`;
    const c = await ac.createCourse(helen, { code, title: "Integration Test Course on Flare Systems", categoryId: category.id, synopsis: "A short course on flare system basics for testing.", overview: "Overview of flare headers, knockout drums and seals.", difficulty: "FOUNDATION", deliveryMode: "SELF_PACED", provider: "Internal", estimatedHours: 1 });
    expect(c.status).toBe("DRAFT");
    await expect(ac.setCourseStatus(helen, c.id, "PUBLISHED")).rejects.toThrow(/Add at least one lesson/);
    const m = await ac.addModule(helen, c.id, "Flare basics", "");
    const l = await ac.saveLesson(helen, m.id, null, { title: "Flare headers", type: "TEXT", body: "## Headers\n\nFlare headers collect relief loads.", durationMinutes: 10, isRequired: true });
    await ac.updateCourseRules(helen, c.id, { requireAllLessons: true, requireAssessmentPass: true, requireAssignmentApproval: false, requireAcknowledgement: false, certificateEnabled: true, cpdEligible: false, cpdUnit: "HOURS", isMandatory: false, enrolmentRule: "OPEN" });
    await expect(ac.setCourseStatus(helen, c.id, "PUBLISHED")).rejects.toThrow(/final assessment/);
    const a = await ac.saveAssessment(helen, c.id, null, { title: "Flare quiz", passingScore: 100, maxAttempts: 2, isFinal: true });
    await ac.saveQuestion(helen, a.id, null, { type: "TRUE_FALSE", prompt: "Knockout drums remove liquids before the flare tip.", points: 1, correctBoolean: "true" });
    await ac.saveLesson(helen, m.id, null, { title: "Flare quiz", type: "ASSESSMENT", durationMinutes: 5, isRequired: true, assessmentId: a.id });
    await ac.setCourseStatus(helen, c.id, "PUBLISHED");

    const lab = await prisma.department.findUniqueOrThrow({ where: { code: "LAB" } });
    const r = await assignLearning(helen, { target: "DEPARTMENT", departmentId: lab.id, courseId: c.id, kind: "REQUIRED", dueDate: new Date(Date.now() + 9e8) });
    expect(r.created).toBeGreaterThan(0);
    const mei = await actor("mei.chen@apex-demo.test");
    await learning.completeLesson(mei, l.id);
    const q = await prisma.assessmentQuestion.findFirstOrThrow({ where: { assessmentId: a.id } });
    await learning.submitAssessment(mei, a.id, [{ questionId: q.id, booleanAnswer: true }]);
    expect(await prisma.certificate.count({ where: { userId: mei.id, courseId: c.id } })).toBe(1);
    expect((await prisma.learningAssignment.findFirstOrThrow({ where: { userId: mei.id, courseId: c.id } })).status).toBe("COMPLETED");
    // History protection: answered questions cannot be edited or deleted
    await expect(ac.saveQuestion(helen, a.id, q.id, { type: "TRUE_FALSE", prompt: "Changed wording here", points: 1, correctBoolean: "false" })).rejects.toThrow(/recorded responses/);
    await expect(ac.deleteQuestion(helen, q.id)).rejects.toThrow(/history/);
  });

  it("imports users from CSV all-or-nothing", async () => {
    const helen = await actor("helen.mercer@apex-demo.test");
    const stamp = Date.now();
    const bad = `name,email,employee_number,department_code,job_role_code,manager_email,roles\nA Person,a.${stamp}@example.com,,OPS,FO,,EMPLOYEE\nB Person,not-an-email,,NOPE,FO,,EMPLOYEE`;
    const r1 = await importUsersCsv(helen, bad, false);
    expect(r1.created).toBe(0);
    expect(r1.errors.map((e) => e.line)).toEqual([3, 3]);
    expect(await prisma.user.count({ where: { email: `a.${stamp}@example.com` } })).toBe(0);
    const good = `name,email,employee_number,department_code,job_role_code,manager_email,roles\nA Person,a.${stamp}@example.com,,OPS,FO,omar.haddad@apex-demo.test,EMPLOYEE\nB Person,b.${stamp}@example.com,,ENG,PE,a.${stamp}@example.com,EMPLOYEE;MANAGER`;
    const r2 = await importUsersCsv(helen, good, true);
    expect(r2.created).toBe(2);
    const b = await prisma.user.findUniqueOrThrow({ where: { email: `b.${stamp}@example.com` }, include: { managedBy: { include: { manager: true } }, roles: { include: { role: true } } } });
    expect(b.status).toBe("INVITED");
    expect(b.managedBy[0].manager.email).toBe(`a.${stamp}@example.com`);
    expect(b.roles.map((r) => r.role.key).sort()).toEqual(["EMPLOYEE", "MANAGER"]);
    expect(await prisma.authToken.count({ where: { userId: b.id, type: "INVITATION" } })).toBe(1);
  });
});

describe("scheduled processes", () => {
  it("notifies about overdue and upcoming items without duplicates", async () => {
    const first = await runScheduledJobs();
    expect(first.overdueReminders).toBeGreaterThan(0);
    const second = await runScheduledJobs();
    expect(second.overdueReminders).toBe(0);
    expect(second.deadlineReminders).toBe(0);
    const daniel = await actor("daniel.reyes@apex-demo.test");
    expect(await prisma.notification.count({ where: { userId: daniel.id, type: "MANDATORY_OVERDUE" } })).toBeGreaterThan(0);
  });
});
