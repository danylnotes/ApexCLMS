export interface CompletionRules {
  requireAllLessons: boolean;
  requireAssessmentPass: boolean;
  requireAssignmentApproval: boolean;
  requireAcknowledgement: boolean;
}

export interface CompletionState {
  requiredLessons: number;
  completedRequiredLessons: number;
  /** Final (completion-bearing) assessments and whether each has a passing graded attempt. */
  finalAssessments: { id: string; passed: boolean }[];
  /** Required assignment lessons and how many have an approved submission. */
  assignmentLessons: number;
  approvedAssignments: number;
  acknowledged: boolean;
}

export interface CompletionCheck {
  rule: keyof CompletionRules;
  label: string;
  met: boolean;
  detail: string;
}

export interface CompletionEvaluation {
  complete: boolean;
  checks: CompletionCheck[];
}

/**
 * Evaluates the configured completion rules for a course. Only enabled rules are checked.
 * A course with no enabled rules cannot be completed — this protects against accidental
 * "instant completion" configuration.
 */
export function evaluateCompletion(rules: CompletionRules, s: CompletionState): CompletionEvaluation {
  const checks: CompletionCheck[] = [];
  if (rules.requireAllLessons) {
    checks.push({
      rule: "requireAllLessons",
      label: "All required lessons completed",
      met: s.requiredLessons > 0 && s.completedRequiredLessons >= s.requiredLessons,
      detail: `${s.completedRequiredLessons} of ${s.requiredLessons} required lessons completed`,
    });
  }
  if (rules.requireAssessmentPass) {
    const passed = s.finalAssessments.filter((a) => a.passed).length;
    const total = s.finalAssessments.length;
    checks.push({
      rule: "requireAssessmentPass",
      label: "Final assessment passed",
      met: total > 0 && passed === total,
      detail: total === 0 ? "No final assessment is configured" : `${passed} of ${total} final assessments passed`,
    });
  }
  if (rules.requireAssignmentApproval) {
    checks.push({
      rule: "requireAssignmentApproval",
      label: "Practical assignment approved",
      met: s.assignmentLessons > 0 && s.approvedAssignments >= s.assignmentLessons,
      detail:
        s.assignmentLessons === 0
          ? "No assignment is configured"
          : `${s.approvedAssignments} of ${s.assignmentLessons} assignments approved by an instructor`,
    });
  }
  if (rules.requireAcknowledgement) {
    checks.push({
      rule: "requireAcknowledgement",
      label: "Mandatory acknowledgement submitted",
      met: s.acknowledged,
      detail: s.acknowledged ? "Acknowledgement recorded" : "Acknowledgement not yet submitted",
    });
  }
  return { complete: checks.length > 0 && checks.every((c) => c.met), checks };
}

/** Validates that a course configuration can be satisfied before it is published. */
export function validateCompletionConfig(
  rules: CompletionRules,
  cfg: { requiredLessons: number; finalAssessments: number; assignmentLessons: number; acknowledgementText?: string | null },
): string[] {
  const errors: string[] = [];
  if (!Object.values(rules).some(Boolean)) errors.push("At least one completion rule must be enabled.");
  if (rules.requireAllLessons && cfg.requiredLessons === 0) errors.push("The course has no required lessons.");
  if (rules.requireAssessmentPass && cfg.finalAssessments === 0) errors.push("A final assessment is required but none is configured.");
  if (rules.requireAssignmentApproval && cfg.assignmentLessons === 0) errors.push("Assignment approval is required but the course has no assignment lesson.");
  if (rules.requireAcknowledgement && !cfg.acknowledgementText?.trim()) errors.push("Acknowledgement text is required.");
  return errors;
}
