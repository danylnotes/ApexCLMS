import { describe, expect, it } from "vitest";
import { courseProgress, remainingMinutes } from "@/lib/domain/progress";
import { evaluateCompletion, validateCompletionConfig } from "@/lib/domain/completion";
import { attemptEligibility, isPass, scoreAttempt } from "@/lib/domain/scoring";
import { assertCpdTransition, claimableValue, summarizeCpd } from "@/lib/domain/cpd";
import { evaluateCompetency, summarizeGaps } from "@/lib/domain/competency";
import { mandatoryState, summarizeCompliance } from "@/lib/domain/compliance";
import { DEFAULT_HEALTH_RULES, evaluateHealth, type HealthInputs } from "@/lib/domain/health";
import { availablePlanTransitions, checkPlanTransition } from "@/lib/domain/plan";
import { passwordPolicyErrors } from "@/server/auth/crypto";

const D = (s: string) => new Date(s);

describe("course progress", () => {
  const lessons = [{ id: "a", isRequired: true }, { id: "b", isRequired: true }, { id: "c", isRequired: false }];
  it("counts required lessons only", () => {
    expect(courseProgress(lessons, ["a", "c"])).toEqual({ completed: 1, total: 2, percent: 50 });
  });
  it("is 0% with no lessons and never divides by zero", () => {
    expect(courseProgress([], [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });
  it("falls back to all lessons when none are required", () => {
    expect(courseProgress([{ id: "x", isRequired: false }], ["x"]).percent).toBe(100);
  });
  it("estimates remaining minutes from incomplete lessons", () => {
    expect(remainingMinutes([{ id: "a", durationMinutes: 30 }, { id: "b", durationMinutes: 20 }], ["a"])).toBe(20);
    expect(remainingMinutes([{ id: "a", durationMinutes: null }], [])).toBeNull();
  });
});

describe("completion rules", () => {
  const rules = { requireAllLessons: true, requireAssessmentPass: true, requireAssignmentApproval: false, requireAcknowledgement: false };
  const base = { requiredLessons: 3, completedRequiredLessons: 3, finalAssessments: [{ id: "f", passed: true }], assignmentLessons: 0, approvedAssignments: 0, acknowledged: false };
  it("completes only when every enabled rule is met", () => {
    expect(evaluateCompletion(rules, base).complete).toBe(true);
    expect(evaluateCompletion(rules, { ...base, completedRequiredLessons: 2 }).complete).toBe(false);
    expect(evaluateCompletion(rules, { ...base, finalAssessments: [{ id: "f", passed: false }] }).complete).toBe(false);
  });
  it("cannot complete when an assessment is required but none exists", () => {
    const e = evaluateCompletion(rules, { ...base, finalAssessments: [] });
    expect(e.complete).toBe(false);
    expect(e.checks.find((c) => c.rule === "requireAssessmentPass")?.detail).toMatch(/No final assessment/);
  });
  it("never completes with no rules enabled", () => {
    expect(evaluateCompletion({ requireAllLessons: false, requireAssessmentPass: false, requireAssignmentApproval: false, requireAcknowledgement: false }, base).complete).toBe(false);
  });
  it("requires assignment approval and acknowledgement when configured", () => {
    const r = { ...rules, requireAssignmentApproval: true, requireAcknowledgement: true };
    expect(evaluateCompletion(r, { ...base, assignmentLessons: 1, approvedAssignments: 0, acknowledged: true }).complete).toBe(false);
    expect(evaluateCompletion(r, { ...base, assignmentLessons: 1, approvedAssignments: 1, acknowledged: false }).complete).toBe(false);
    expect(evaluateCompletion(r, { ...base, assignmentLessons: 1, approvedAssignments: 1, acknowledged: true }).complete).toBe(true);
  });
  it("validates configuration before publishing", () => {
    expect(validateCompletionConfig(rules, { requiredLessons: 2, finalAssessments: 0, assignmentLessons: 0 })).toContain("A final assessment is required but none is configured.");
    expect(validateCompletionConfig({ ...rules, requireAssessmentPass: false, requireAcknowledgement: true }, { requiredLessons: 1, finalAssessments: 0, assignmentLessons: 0, acknowledgementText: "" })).toContain("Acknowledgement text is required.");
  });
});

describe("assessment scoring", () => {
  const qs = [
    { id: "q1", type: "MULTIPLE_CHOICE" as const, points: 2, correctOptionId: "b" },
    { id: "q2", type: "TRUE_FALSE" as const, points: 1, correctBoolean: false },
    { id: "q3", type: "TRUE_FALSE" as const, points: 1, correctBoolean: true },
  ];
  it("scores objective questions", () => {
    const r = scoreAttempt(qs, [{ questionId: "q1", selectedOptionId: "b" }, { questionId: "q2", booleanAnswer: true }, { questionId: "q3", booleanAnswer: true }]);
    expect(r).toMatchObject({ score: 3, maxScore: 4, percent: 75, needsReview: false });
  });
  it("treats unanswered questions as incorrect", () => {
    expect(scoreAttempt(qs, []).percent).toBe(0);
  });
  it("defers percent when short answers need review", () => {
    const r = scoreAttempt([...qs, { id: "s", type: "SHORT_ANSWER", points: 2 }], [{ questionId: "s", textAnswer: "An answer" }]);
    expect(r.needsReview).toBe(true);
    expect(r.percent).toBeNull();
    expect(r.responses.find((x) => x.questionId === "s")?.pointsAwarded).toBeNull();
  });
  it("applies the pass mark inclusively", () => {
    expect(isPass(70, 70)).toBe(true);
    expect(isPass(69, 70)).toBe(false);
  });
  it("enforces attempt limits", () => {
    expect(attemptEligibility({ attemptsUsed: 3, maxAttempts: 3, alreadyPassed: false, pendingReview: false }).allowed).toBe(false);
    expect(attemptEligibility({ attemptsUsed: 1, maxAttempts: 3, alreadyPassed: true, pendingReview: false }).allowed).toBe(false);
    expect(attemptEligibility({ attemptsUsed: 1, maxAttempts: 3, alreadyPassed: false, pendingReview: true }).allowed).toBe(false);
    expect(attemptEligibility({ attemptsUsed: 9, maxAttempts: 0, alreadyPassed: false, pendingReview: false }).allowed).toBe(true);
  });
});

describe("CPD", () => {
  it("follows Draft → Submitted → Under review → Approved/Rejected", () => {
    expect(() => assertCpdTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertCpdTransition("SUBMITTED", "UNDER_REVIEW")).not.toThrow();
    expect(() => assertCpdTransition("DRAFT", "APPROVED", { approvedValue: 1 })).toThrow();
    expect(() => assertCpdTransition("APPROVED", "DRAFT")).toThrow();
  });
  it("requires a reason to reject", () => {
    expect(() => assertCpdTransition("UNDER_REVIEW", "REJECTED", { reason: " " })).toThrow(/reason/);
    expect(() => assertCpdTransition("UNDER_REVIEW", "REJECTED", { reason: "Insufficient evidence" })).not.toThrow();
  });
  it("bounds the approved value", () => {
    expect(() => assertCpdTransition("UNDER_REVIEW", "APPROVED", { approvedValue: 0 })).toThrow();
    expect(() => assertCpdTransition("UNDER_REVIEW", "APPROVED", { approvedValue: 6, claimedValue: 5 })).toThrow(/exceed/);
  });
  it("converts hours to points and applies caps", () => {
    expect(claimableValue(10, { unit: "POINTS", pointsPerHour: 1.5, maxPerActivity: 8, targetPerPeriod: null })).toBe(8);
    expect(claimableValue(3, { unit: "HOURS", pointsPerHour: null, maxPerActivity: null, targetPerPeriod: null })).toBe(3);
    expect(claimableValue(3, null)).toBe(3);
  });
  it("summarises only approved claims as approved and computes pro-rata expectation", () => {
    const s = summarizeCpd(
      [{ status: "APPROVED", claimedValue: 5, approvedValue: 4 }, { status: "SUBMITTED", claimedValue: 3, approvedValue: null }, { status: "REJECTED", claimedValue: 9, approvedValue: null }],
      20,
      { startDate: D("2026-01-01"), endDate: D("2026-12-31") },
      D("2026-07-02"),
    );
    expect(s).toMatchObject({ approved: 4, pending: 3, pendingCount: 1, rejectedCount: 1, remaining: 16, percentOfTarget: 20 });
    expect(s.proRataExpected).toBeCloseTo(10, 0);
  });
  it("reports no remaining target when no target is configured", () => {
    expect(summarizeCpd([], null, { startDate: D("2026-01-01"), endDate: D("2026-12-31") }).remaining).toBeNull();
  });
});

describe("competency gaps", () => {
  const now = D("2026-10-01");
  it("identifies met, gap, expired and not-assessed", () => {
    expect(evaluateCompetency(3, { level: 3, basis: "DEMONSTRATED", assessedAt: now, reassessmentDue: null }, { allowKnowledgeAsCompetence: false, now }).status).toBe("MET");
    expect(evaluateCompetency(3, { level: 1, basis: "DEMONSTRATED", assessedAt: now, reassessmentDue: null }, { allowKnowledgeAsCompetence: false, now })).toMatchObject({ status: "GAP", gap: 2 });
    expect(evaluateCompetency(2, { level: 3, basis: "DEMONSTRATED", assessedAt: now, reassessmentDue: D("2026-01-01") }, { allowKnowledgeAsCompetence: false, now })).toMatchObject({ status: "EXPIRED", effectiveLevel: 0 });
    expect(evaluateCompetency(2, null, { allowKnowledgeAsCompetence: false, now })).toMatchObject({ status: "NOT_ASSESSED", gap: 2 });
  });
  it("does not treat course completion as competence unless the framework allows it", () => {
    const k = { level: 3, basis: "KNOWLEDGE" as const, assessedAt: now, reassessmentDue: null };
    expect(evaluateCompetency(2, k, { allowKnowledgeAsCompetence: false, now })).toMatchObject({ status: "GAP", knowledgeOnly: true, effectiveLevel: 0 });
    expect(evaluateCompetency(2, k, { allowKnowledgeAsCompetence: true, now }).status).toBe("MET");
  });
  it("summarises coverage and significant gaps", () => {
    const rows = [
      evaluateCompetency(2, { level: 2, basis: "DEMONSTRATED", assessedAt: now, reassessmentDue: null }, { allowKnowledgeAsCompetence: false, now }),
      evaluateCompetency(4, { level: 1, basis: "DEMONSTRATED", assessedAt: now, reassessmentDue: null }, { allowKnowledgeAsCompetence: false, now }),
      evaluateCompetency(2, null, { allowKnowledgeAsCompetence: false, now }),
    ];
    expect(summarizeGaps(rows)).toMatchObject({ required: 3, met: 1, gaps: 1, notAssessed: 1, significantGaps: 2, coveragePercent: 33 });
  });
});

describe("mandatory compliance", () => {
  const now = D("2026-10-01");
  it("classifies items", () => {
    expect(mandatoryState({ dueDate: D("2026-09-01"), completedAt: null }, now)).toBe("OVERDUE");
    expect(mandatoryState({ dueDate: D("2026-10-10"), completedAt: null }, now)).toBe("DUE_SOON");
    expect(mandatoryState({ dueDate: D("2027-01-10"), completedAt: null }, now)).toBe("PENDING");
    expect(mandatoryState({ dueDate: D("2026-09-01"), completedAt: D("2026-08-01") }, now)).toBe("COMPLETED");
  });
  it("excludes not-yet-due items from the rate", () => {
    const s = summarizeCompliance([{ dueDate: D("2026-09-01"), completedAt: D("2026-08-01") }, { dueDate: D("2026-09-01"), completedAt: null }, { dueDate: D("2027-01-01"), completedAt: null }], now);
    expect(s).toMatchObject({ total: 3, completed: 1, overdue: 1, pending: 1, ratePercent: 50 });
    expect(summarizeCompliance([{ dueDate: D("2027-01-01"), completedAt: null }], now).ratePercent).toBeNull();
  });
});

describe("career development health", () => {
  const now = D("2026-10-01");
  const base: HealthInputs = {
    now,
    learning: { assignedTotal: 0, assignedCompleted: 0, assignedOverdue: 0, activeEnrollments: 0, lastActivityAt: null, paths: [] },
    competency: { hasRoleRequirements: false, roleTitle: null, summary: null, lastAssessedAt: null },
    professional: { hasPolicy: false, policyName: null, unit: "HOURS", cpd: null, validCertificates: 0, verifiedCredentials: 0 },
    compliance: { total: 0, completed: 0, overdue: 0, dueSoon: 0, pending: 0, ratePercent: null, expiringSoon: 0, expired: 0, overdueReassessments: 0 },
    career: { targetRoleTitle: null, targetSummary: null, plan: null },
  };
  it("reports Insufficient Data rather than inventing a score", () => {
    const h = evaluateHealth(base);
    expect(h).toHaveLength(5);
    expect(h.every((d) => d.status === "INSUFFICIENT")).toBe(true);
    expect(h.every((d) => d.method.length > 20)).toBe(true);
  });
  it("flags overdue mandatory training as Action Required", () => {
    const h = evaluateHealth({ ...base, compliance: { ...base.compliance, total: 2, completed: 1, overdue: 1, ratePercent: 50 } });
    expect(h.find((d) => d.key === "compliance")?.status).toBe("ACTION");
  });
  it("rates learning on track when assignments are completed recently", () => {
    const h = evaluateHealth({ ...base, learning: { ...base.learning, assignedTotal: 4, assignedCompleted: 4, activeEnrollments: 1, lastActivityAt: D("2026-09-20") } });
    expect(h.find((d) => d.key === "learning")?.status).toBe("ON_TRACK");
  });
  it("uses configurable thresholds", () => {
    const inputs = { ...base, learning: { ...base.learning, assignedTotal: 10, assignedCompleted: 5, activeEnrollments: 1, lastActivityAt: D("2026-09-20") } };
    expect(evaluateHealth(inputs, DEFAULT_HEALTH_RULES).find((d) => d.key === "learning")?.status).toBe("ATTENTION");
    expect(evaluateHealth(inputs, { ...DEFAULT_HEALTH_RULES, learningOnTrackPercent: 50 }).find((d) => d.key === "learning")?.status).toBe("ON_TRACK");
  });
  it("evaluates CPD against the pro-rata target", () => {
    const cpd = (approved: number) => ({ approved, pending: 0, pendingCount: 0, rejectedCount: 0, draftCount: 0, target: 20, remaining: 20 - approved, percentOfTarget: approved * 5, proRataExpected: 10, periodElapsedPercent: 50 });
    const run = (a: number) => evaluateHealth({ ...base, professional: { ...base.professional, hasPolicy: true, policyName: "P", cpd: cpd(a) } }).find((d) => d.key === "professional")?.status;
    expect(run(12)).toBe("ON_TRACK");
    expect(run(7)).toBe("ATTENTION");
    expect(run(2)).toBe("ACTION");
  });
  it("requires an agreed plan for career progression", () => {
    const plan = { status: "MANAGER_REVIEW", lastReviewedAt: null, objectivesTotal: 2, objectivesCompleted: 0, objectivesOverdue: 0 };
    expect(evaluateHealth({ ...base, career: { targetRoleTitle: "Supervisor", targetSummary: null, plan } }).find((d) => d.key === "career")?.status).toBe("ACTION");
    expect(evaluateHealth({ ...base, career: { targetRoleTitle: "Supervisor", targetSummary: null, plan: { ...plan, status: "IN_PROGRESS", lastReviewedAt: D("2026-08-01") } } }).find((d) => d.key === "career")?.status).toBe("ON_TRACK");
  });
});

describe("development plan workflow", () => {
  it("separates owner and reviewer steps", () => {
    expect(availablePlanTransitions("MANAGER_REVIEW", "OWNER")).toHaveLength(0);
    expect(availablePlanTransitions("MANAGER_REVIEW", "REVIEWER").map((t) => t.to)).toEqual(["AGREED", "DRAFT"]);
    expect(checkPlanTransition("MANAGER_REVIEW", "AGREED", "OWNER", { objectives: 1 })).toMatch(/manager/);
    expect(checkPlanTransition("DRAFT", "AGREED", "REVIEWER", { objectives: 1 })).toMatch(/cannot move/);
  });
  it("requires objectives before review and a comment when returning", () => {
    expect(checkPlanTransition("EMPLOYEE_REVIEW", "MANAGER_REVIEW", "OWNER", { objectives: 0 })).toMatch(/objective/);
    expect(checkPlanTransition("MANAGER_REVIEW", "DRAFT", "REVIEWER", { objectives: 1, comment: "" })).toMatch(/comment/);
    expect(checkPlanTransition("MANAGER_REVIEW", "DRAFT", "REVIEWER", { objectives: 1, comment: "Add dates" })).toBeNull();
  });
});

describe("password policy", () => {
  it("requires length and character classes", () => {
    expect(passwordPolicyErrors("short")).not.toHaveLength(0);
    expect(passwordPolicyErrors("Long-enough-Passw0rd")).toHaveLength(0);
  });
});
