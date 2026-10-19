import type { ComplianceSummary } from "./compliance";
import type { CpdSummary } from "./cpd";
import type { GapSummary } from "./competency";

/**
 * Career Development Health — five transparent, rule-based dimensions.
 * There is deliberately no composite score: each dimension states its rule, its evidence
 * and the next action. Status is a development prompt, not an employment decision.
 */

export type HealthStatus = "ON_TRACK" | "ATTENTION" | "ACTION" | "INSUFFICIENT";

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  ON_TRACK: "On Track",
  ATTENTION: "Attention Required",
  ACTION: "Action Required",
  INSUFFICIENT: "Insufficient Data",
};

export interface HealthRules {
  /** Assigned-learning completion % at or above which learning is on track. */
  learningOnTrackPercent: number;
  /** Days without learning activity before engagement needs attention. */
  inactivityDays: number;
  /** Approved CPD ÷ pro-rata expected, below which CPD needs action (above → attention until 1.0). */
  cpdActionRatio: number;
  /** Days ahead to flag mandatory items as due soon. */
  dueSoonDays: number;
  /** Days ahead to flag certificates/credentials as expiring. */
  expiringDays: number;
  /** Months after which a development plan review is considered stale. */
  planReviewMonths: number;
  /** Gap (in proficiency levels) considered significant. */
  significantGapLevels: number;
}

export const DEFAULT_HEALTH_RULES: HealthRules = {
  learningOnTrackPercent: 60,
  inactivityDays: 90,
  cpdActionRatio: 0.5,
  dueSoonDays: 30,
  expiringDays: 60,
  planReviewMonths: 12,
  significantGapLevels: 2,
};

export interface HealthInputs {
  now: Date;
  learning: {
    assignedTotal: number;
    assignedCompleted: number;
    assignedOverdue: number;
    activeEnrollments: number;
    lastActivityAt: Date | null;
    paths: { title: string; percent: number }[];
  };
  competency: { hasRoleRequirements: boolean; roleTitle: string | null; summary: GapSummary | null; lastAssessedAt: Date | null };
  professional: {
    hasPolicy: boolean;
    policyName: string | null;
    unit: "HOURS" | "POINTS";
    cpd: CpdSummary | null;
    validCertificates: number;
    verifiedCredentials: number;
  };
  compliance: ComplianceSummary & { expiringSoon: number; expired: number; overdueReassessments: number };
  career: {
    targetRoleTitle: string | null;
    targetSummary: GapSummary | null;
    plan: {
      status: string;
      lastReviewedAt: Date | null;
      objectivesTotal: number;
      objectivesCompleted: number;
      objectivesOverdue: number;
    } | null;
  };
}

export interface HealthDimension {
  key: "learning" | "competency" | "professional" | "compliance" | "career";
  title: string;
  status: HealthStatus;
  evidence: string[];
  gaps: string[];
  nextAction: { label: string; href: string } | null;
  method: string;
  lastReviewed: Date | null;
}

const days = (n: number) => n * 86_400_000;

export function evaluateLearning(i: HealthInputs, r: HealthRules): HealthDimension {
  const l = i.learning;
  const method = `Action Required if any assigned learning is overdue. Attention Required if assigned-learning completion is below ${r.learningOnTrackPercent}% or there has been no learning activity for ${r.inactivityDays} days. Otherwise On Track. Insufficient Data when no learning has been assigned or started.`;
  const base = { key: "learning" as const, title: "Learning Progress", method, lastReviewed: l.lastActivityAt };
  if (l.assignedTotal === 0 && l.activeEnrollments === 0 && l.paths.length === 0 && !l.lastActivityAt) {
    return { ...base, status: "INSUFFICIENT", evidence: ["No assigned learning or course activity recorded."], gaps: [], nextAction: { label: "Browse the course catalogue", href: "/catalogue" } };
  }
  const pct = l.assignedTotal ? Math.round((l.assignedCompleted / l.assignedTotal) * 100) : null;
  const evidence: string[] = [];
  if (pct != null) evidence.push(`${l.assignedCompleted} of ${l.assignedTotal} assigned items completed (${pct}%).`);
  evidence.push(`${l.activeEnrollments} course${l.activeEnrollments === 1 ? "" : "s"} in progress.`);
  for (const p of l.paths) evidence.push(`Learning path "${p.title}": ${p.percent}% complete.`);
  const gaps: string[] = [];
  const inactive = !l.lastActivityAt || i.now.getTime() - l.lastActivityAt.getTime() > days(r.inactivityDays);
  if (l.assignedOverdue > 0) gaps.push(`${l.assignedOverdue} assigned item${l.assignedOverdue === 1 ? " is" : "s are"} overdue.`);
  if (pct != null && pct < r.learningOnTrackPercent) gaps.push(`Assigned-learning completion is below ${r.learningOnTrackPercent}%.`);
  if (inactive) gaps.push(`No learning activity in the last ${r.inactivityDays} days.`);
  const status: HealthStatus = l.assignedOverdue > 0 ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return {
    ...base,
    status,
    evidence,
    gaps,
    nextAction: l.assignedOverdue > 0 ? { label: "Review overdue assignments", href: "/my-learning?tab=assigned" } : { label: "Continue learning", href: "/my-learning" },
  };
}

export function evaluateCompetency(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.competency;
  const method = `Compares your latest current competency assessments with the requirements of your current role. Action Required if any gap is ${r.significantGapLevels}+ proficiency levels. Attention Required if any requirement is unmet, expired or not yet assessed. Knowledge-only evidence counts only where the framework allows it.`;
  const base = { key: "competency" as const, title: "Competency Readiness", method, lastReviewed: c.lastAssessedAt };
  if (!c.hasRoleRequirements || !c.summary || c.summary.required === 0) {
    return { ...base, status: "INSUFFICIENT", evidence: [c.roleTitle ? `No competency requirements are configured for ${c.roleTitle}.` : "No job role is assigned to your profile."], gaps: [], nextAction: { label: "View competency profile", href: "/competencies" } };
  }
  const s = c.summary;
  const evidence = [`${s.met} of ${s.required} required competencies met (${s.coveragePercent}%).`, `${s.assessed} of ${s.required} have a current assessment.`];
  const gaps: string[] = [];
  if (s.significantGaps) gaps.push(`${s.significantGaps} significant gap${s.significantGaps === 1 ? "" : "s"} (${r.significantGapLevels}+ levels).`);
  if (s.gaps) gaps.push(`${s.gaps} requirement${s.gaps === 1 ? "" : "s"} below the required level.`);
  if (s.expired) gaps.push(`${s.expired} assessment${s.expired === 1 ? " has" : "s have"} passed the reassessment date.`);
  if (s.notAssessed) gaps.push(`${s.notAssessed} requirement${s.notAssessed === 1 ? " has" : "s have"} not been assessed.`);
  const status: HealthStatus = s.significantGaps > 0 ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: gaps.length ? { label: "Review competency gaps", href: "/competencies" } : { label: "View competency profile", href: "/competencies" } };
}

export function evaluateProfessional(i: HealthInputs, r: HealthRules): HealthDimension {
  const p = i.professional;
  const u = p.unit === "POINTS" ? "points" : "hours";
  const method = `Approved CPD for the current reporting period compared with the pro-rata share of your CPD policy target. On Track at or above the pro-rata expectation; Attention Required between ${Math.round(r.cpdActionRatio * 100)}% and 100% of it; Action Required below ${Math.round(r.cpdActionRatio * 100)}%. Only approved claims count. Insufficient Data when no CPD policy with a target applies to you.`;
  const base = { key: "professional" as const, title: "Professional Development", method, lastReviewed: null };
  const evidence: string[] = [];
  if (p.validCertificates) evidence.push(`${p.validCertificates} valid course certificate${p.validCertificates === 1 ? "" : "s"}.`);
  if (p.verifiedCredentials) evidence.push(`${p.verifiedCredentials} verified professional credential${p.verifiedCredentials === 1 ? "" : "s"}.`);
  if (!p.hasPolicy || !p.cpd || p.cpd.target == null) {
    return { ...base, status: "INSUFFICIENT", evidence: evidence.length ? evidence : ["No CPD policy with a target applies to your profile."], gaps: [], nextAction: { label: "Open CPD workspace", href: "/cpd" } };
  }
  const cpd = p.cpd;
  evidence.unshift(`${cpd.approved} of ${cpd.target} ${u} approved under ${p.policyName} (${cpd.periodElapsedPercent}% of period elapsed).`);
  if (cpd.pendingCount) evidence.push(`${cpd.pendingCount} claim${cpd.pendingCount === 1 ? "" : "s"} (${cpd.pending} ${u}) awaiting review.`);
  const expected = cpd.proRataExpected ?? 0;
  const ratio = expected > 0 ? cpd.approved / expected : 1;
  const gaps: string[] = [];
  if (ratio < 1) gaps.push(`Approved CPD is below the pro-rata expectation of ${expected} ${u}.`);
  const status: HealthStatus = ratio >= 1 ? "ON_TRACK" : ratio >= r.cpdActionRatio ? "ATTENTION" : "ACTION";
  return { ...base, status, evidence, gaps, nextAction: { label: status === "ON_TRACK" ? "View CPD record" : "Record a CPD activity", href: status === "ON_TRACK" ? "/cpd" : "/cpd/new" } };
}

export function evaluateCompliance(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.compliance;
  const method = `Action Required if any mandatory training is overdue, a required certificate has expired, or a competency reassessment is overdue. Attention Required if mandatory items fall due within ${r.dueSoonDays} days or certificates expire within ${r.expiringDays} days.`;
  const base = { key: "compliance" as const, title: "Compliance Readiness", method, lastReviewed: null };
  if (c.total === 0 && c.expiringSoon === 0 && c.expired === 0 && c.overdueReassessments === 0) {
    return { ...base, status: "INSUFFICIENT", evidence: ["No mandatory training has been assigned to you."], gaps: [], nextAction: null };
  }
  const evidence = [`${c.completed} of ${c.total} mandatory items completed.`];
  if (c.ratePercent != null) evidence.push(`Compliance rate ${c.ratePercent}% of items that have fallen due.`);
  const gaps: string[] = [];
  if (c.overdue) gaps.push(`${c.overdue} mandatory item${c.overdue === 1 ? " is" : "s are"} overdue.`);
  if (c.expired) gaps.push(`${c.expired} certificate${c.expired === 1 ? " has" : "s have"} expired.`);
  if (c.overdueReassessments) gaps.push(`${c.overdueReassessments} competency reassessment${c.overdueReassessments === 1 ? " is" : "s are"} overdue.`);
  const action = gaps.length > 0;
  if (c.dueSoon) gaps.push(`${c.dueSoon} mandatory item${c.dueSoon === 1 ? "" : "s"} due within ${r.dueSoonDays} days.`);
  if (c.expiringSoon) gaps.push(`${c.expiringSoon} certificate${c.expiringSoon === 1 ? "" : "s"} expiring within ${r.expiringDays} days.`);
  const status: HealthStatus = action ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: status === "ON_TRACK" ? { label: "View requirements", href: "/my-learning?tab=mandatory" } : { label: "Complete mandatory training", href: "/my-learning?tab=mandatory" } };
}

export function evaluateCareer(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.career;
  const method = `Requires a target role and a development plan. Action Required if no plan has been agreed or objectives are overdue. Attention Required if the plan has not been reviewed within ${r.planReviewMonths} months or competency gaps to the target role remain. This indicator supports development conversations; it is not a promotion-readiness prediction.`;
  const base = { key: "career" as const, title: "Career Progression", method, lastReviewed: c.plan?.lastReviewedAt ?? null };
  if (!c.targetRoleTitle && !c.plan) {
    return { ...base, status: "INSUFFICIENT", evidence: ["No target role or development plan recorded."], gaps: [], nextAction: { label: "Start a development plan", href: "/development-plan" } };
  }
  const evidence: string[] = [];
  const gaps: string[] = [];
  if (c.targetRoleTitle) evidence.push(`Target role: ${c.targetRoleTitle}.`);
  if (c.targetSummary && c.targetSummary.required > 0) {
    evidence.push(`${c.targetSummary.met} of ${c.targetSummary.required} target-role competencies already met.`);
    const open = c.targetSummary.required - c.targetSummary.met;
    if (open) gaps.push(`${open} competenc${open === 1 ? "y" : "ies"} to develop for the target role.`);
  }
  let action = false;
  const agreed = c.plan && ["AGREED", "IN_PROGRESS", "COMPLETED"].includes(c.plan.status);
  if (!c.plan) {
    gaps.push("No development plan has been created.");
    action = true;
  } else {
    evidence.push(`Development plan status: ${c.plan.status.replace(/_/g, " ").toLowerCase()}; ${c.plan.objectivesCompleted} of ${c.plan.objectivesTotal} objectives completed.`);
    if (!agreed) {
      gaps.push("The development plan has not yet been agreed with your manager.");
      action = true;
    }
    if (c.plan.objectivesOverdue) {
      gaps.push(`${c.plan.objectivesOverdue} objective${c.plan.objectivesOverdue === 1 ? " is" : "s are"} past the target date.`);
      action = true;
    }
    const stale = !c.plan.lastReviewedAt || i.now.getTime() - c.plan.lastReviewedAt.getTime() > days(r.planReviewMonths * 30.44);
    if (stale) gaps.push(`The plan has not been reviewed in the last ${r.planReviewMonths} months.`);
  }
  if (!c.targetRoleTitle) gaps.push("No target role is recorded on your profile.");
  const status: HealthStatus = action ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: { label: c.plan ? "Open development plan" : "Start a development plan", href: "/development-plan" } };
}

export function evaluateHealth(inputs: HealthInputs, rules: HealthRules = DEFAULT_HEALTH_RULES): HealthDimension[] {
  return [
    evaluateLearning(inputs, rules),
    evaluateCompetency(inputs, rules),
    evaluateCompliance(inputs, rules),
    evaluateProfessional(inputs, rules),
    evaluateCareer(inputs, rules),
  ];
}
