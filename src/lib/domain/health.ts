import type { ComplianceSummary } from "./compliance";
import type { CpdSummary } from "./cpd";
import type { GapSummary } from "./competency";
import { tr } from "@/i18n/active";
import { PLAN_STATUS_LABEL, type PlanStatus } from "./plan";

/**
 * Career Development Health — five transparent, rule-based dimensions.
 * There is deliberately no composite score: each dimension states its rule, its evidence
 * and the next action. Status is a development prompt, not an employment decision.
 */

export type HealthStatus = "ON_TRACK" | "ATTENTION" | "ACTION" | "INSUFFICIENT";

const HEALTH_STATUS_SOURCE: Record<HealthStatus, string> = {
  ON_TRACK: "On Track",
  ATTENTION: "Attention Required",
  ACTION: "Action Required",
  INSUFFICIENT: "Insufficient Data",
};

/** Translates on read, so every call site shows the current request's language. */
export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = new Proxy(HEALTH_STATUS_SOURCE, {
  get: (target, key) => (typeof key === "string" && key in target ? tr(target[key as HealthStatus]) : Reflect.get(target, key)),
});

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
  const method = tr("Action Required if any assigned learning is overdue. Attention Required if assigned-learning completion is below {percent}% or there has been no learning activity for {days} days. Otherwise On Track. Insufficient Data when no learning has been assigned or started.", { percent: r.learningOnTrackPercent, days: r.inactivityDays });
  const base = { key: "learning" as const, title: tr("Learning Progress"), method, lastReviewed: l.lastActivityAt };
  if (l.assignedTotal === 0 && l.activeEnrollments === 0 && l.paths.length === 0 && !l.lastActivityAt) {
    return { ...base, status: "INSUFFICIENT", evidence: [tr("No assigned learning or course activity recorded.")], gaps: [], nextAction: { label: tr("Browse the course catalogue"), href: "/catalogue" } };
  }
  const pct = l.assignedTotal ? Math.round((l.assignedCompleted / l.assignedTotal) * 100) : null;
  const evidence: string[] = [];
  if (pct != null) evidence.push(tr("{completed} of {total} assigned items completed ({percent}%).", { completed: l.assignedCompleted, total: l.assignedTotal, percent: pct }));
  evidence.push(tr("{count, plural, one {# course} other {# courses}} in progress.", { count: l.activeEnrollments }));
  for (const p of l.paths) evidence.push(tr("Learning path \"{title}\": {percent}% complete.", { title: p.title, percent: p.percent }));
  const gaps: string[] = [];
  const inactive = !l.lastActivityAt || i.now.getTime() - l.lastActivityAt.getTime() > days(r.inactivityDays);
  if (l.assignedOverdue > 0) gaps.push(tr("{count, plural, one {# assigned item is} other {# assigned items are}} overdue.", { count: l.assignedOverdue }));
  if (pct != null && pct < r.learningOnTrackPercent) gaps.push(tr("Assigned-learning completion is below {percent}%.", { percent: r.learningOnTrackPercent }));
  if (inactive) gaps.push(tr("No learning activity in the last {days} days.", { days: r.inactivityDays }));
  const status: HealthStatus = l.assignedOverdue > 0 ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return {
    ...base,
    status,
    evidence,
    gaps,
    nextAction: l.assignedOverdue > 0 ? { label: tr("Review overdue assignments"), href: "/my-learning?tab=assigned" } : { label: tr("Continue learning"), href: "/my-learning" },
  };
}

export function evaluateCompetency(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.competency;
  const method = tr("Compares your latest current competency assessments with the requirements of your current role. Action Required if any gap is {levels}+ proficiency levels. Attention Required if any requirement is unmet, expired or not yet assessed. Knowledge-only evidence counts only where the framework allows it.", { levels: r.significantGapLevels });
  const base = { key: "competency" as const, title: tr("Competency Readiness"), method, lastReviewed: c.lastAssessedAt };
  if (!c.hasRoleRequirements || !c.summary || c.summary.required === 0) {
    return { ...base, status: "INSUFFICIENT", evidence: [c.roleTitle ? tr("No competency requirements are configured for {role}.", { role: c.roleTitle }) : tr("No job role is assigned to your profile.")], gaps: [], nextAction: { label: tr("View competency profile"), href: "/competencies" } };
  }
  const s = c.summary;
  const evidence = [tr("{met} of {required} required competencies met ({percent}%).", { met: s.met, required: s.required, percent: s.coveragePercent }), tr("{assessed} of {required} have a current assessment.", { assessed: s.assessed, required: s.required })];
  const gaps: string[] = [];
  if (s.significantGaps) gaps.push(tr("{count, plural, one {# significant gap} other {# significant gaps}} ({levels}+ levels).", { count: s.significantGaps, levels: r.significantGapLevels }));
  if (s.gaps) gaps.push(tr("{count, plural, one {# requirement} other {# requirements}} below the required level.", { count: s.gaps }));
  if (s.expired) gaps.push(tr("{count, plural, one {# assessment has} other {# assessments have}} passed the reassessment date.", { count: s.expired }));
  if (s.notAssessed) gaps.push(tr("{count, plural, one {# requirement has} other {# requirements have}} not been assessed.", { count: s.notAssessed }));
  const status: HealthStatus = s.significantGaps > 0 ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: gaps.length ? { label: tr("Review competency gaps"), href: "/competencies" } : { label: tr("View competency profile"), href: "/competencies" } };
}

export function evaluateProfessional(i: HealthInputs, r: HealthRules): HealthDimension {
  const p = i.professional;
  const u = p.unit === "POINTS" ? tr("points") : tr("hours");
  const method = tr("Approved CPD for the current reporting period compared with the pro-rata share of your CPD policy target. On Track at or above the pro-rata expectation; Attention Required between {percent}% and 100% of it; Action Required below {percent}%. Only approved claims count. Insufficient Data when no CPD policy with a target applies to you.", { percent: Math.round(r.cpdActionRatio * 100) });
  const base = { key: "professional" as const, title: tr("Professional Development"), method, lastReviewed: null };
  const evidence: string[] = [];
  if (p.validCertificates) evidence.push(tr("{count, plural, one {# valid course certificate} other {# valid course certificates}}.", { count: p.validCertificates }));
  if (p.verifiedCredentials) evidence.push(tr("{count, plural, one {# verified professional credential} other {# verified professional credentials}}.", { count: p.verifiedCredentials }));
  if (!p.hasPolicy || !p.cpd || p.cpd.target == null) {
    return { ...base, status: "INSUFFICIENT", evidence: evidence.length ? evidence : [tr("No CPD policy with a target applies to your profile.")], gaps: [], nextAction: { label: tr("Open CPD workspace"), href: "/cpd" } };
  }
  const cpd = p.cpd;
  evidence.unshift(tr("{approved} of {target} {unit} approved under {policy} ({percent}% of period elapsed).", { approved: cpd.approved, target: cpd.target, unit: u, policy: p.policyName, percent: cpd.periodElapsedPercent }));
  if (cpd.pendingCount) evidence.push(tr("{count, plural, one {# claim} other {# claims}} ({value} {unit}) awaiting review.", { count: cpd.pendingCount, value: cpd.pending, unit: u }));
  const expected = cpd.proRataExpected ?? 0;
  const ratio = expected > 0 ? cpd.approved / expected : 1;
  const gaps: string[] = [];
  if (ratio < 1) gaps.push(tr("Approved CPD is below the pro-rata expectation of {value} {unit}.", { value: expected, unit: u }));
  const status: HealthStatus = ratio >= 1 ? "ON_TRACK" : ratio >= r.cpdActionRatio ? "ATTENTION" : "ACTION";
  return { ...base, status, evidence, gaps, nextAction: { label: status === "ON_TRACK" ? tr("View CPD record") : tr("Record a CPD activity"), href: status === "ON_TRACK" ? "/cpd" : "/cpd/new" } };
}

export function evaluateCompliance(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.compliance;
  const method = tr("Action Required if any mandatory training is overdue, a required certificate has expired, or a competency reassessment is overdue. Attention Required if mandatory items fall due within {dueDays} days or certificates expire within {expiringDays} days.", { dueDays: r.dueSoonDays, expiringDays: r.expiringDays });
  const base = { key: "compliance" as const, title: tr("Compliance Readiness"), method, lastReviewed: null };
  if (c.total === 0 && c.expiringSoon === 0 && c.expired === 0 && c.overdueReassessments === 0) {
    return { ...base, status: "INSUFFICIENT", evidence: [tr("No mandatory training has been assigned to you.")], gaps: [], nextAction: null };
  }
  const evidence = [tr("{completed} of {total} mandatory items completed.", { completed: c.completed, total: c.total })];
  if (c.ratePercent != null) evidence.push(tr("Compliance rate {percent}% of items that have fallen due.", { percent: c.ratePercent }));
  const gaps: string[] = [];
  if (c.overdue) gaps.push(tr("{count, plural, one {# mandatory item is} other {# mandatory items are}} overdue.", { count: c.overdue }));
  if (c.expired) gaps.push(tr("{count, plural, one {# certificate has} other {# certificates have}} expired.", { count: c.expired }));
  if (c.overdueReassessments) gaps.push(tr("{count, plural, one {# competency reassessment is} other {# competency reassessments are}} overdue.", { count: c.overdueReassessments }));
  const action = gaps.length > 0;
  if (c.dueSoon) gaps.push(tr("{count, plural, one {# mandatory item} other {# mandatory items}} due within {days} days.", { count: c.dueSoon, days: r.dueSoonDays }));
  if (c.expiringSoon) gaps.push(tr("{count, plural, one {# certificate} other {# certificates}} expiring within {days} days.", { count: c.expiringSoon, days: r.expiringDays }));
  const status: HealthStatus = action ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: status === "ON_TRACK" ? { label: tr("View requirements"), href: "/my-learning?tab=mandatory" } : { label: tr("Complete mandatory training"), href: "/my-learning?tab=mandatory" } };
}

export function evaluateCareer(i: HealthInputs, r: HealthRules): HealthDimension {
  const c = i.career;
  const method = tr("Requires a target role and a development plan. Action Required if no plan has been agreed or objectives are overdue. Attention Required if the plan has not been reviewed within {months} months or competency gaps to the target role remain. This indicator supports development conversations; it is not a promotion-readiness prediction.", { months: r.planReviewMonths });
  const base = { key: "career" as const, title: tr("Career Progression"), method, lastReviewed: c.plan?.lastReviewedAt ?? null };
  if (!c.targetRoleTitle && !c.plan) {
    return { ...base, status: "INSUFFICIENT", evidence: [tr("No target role or development plan recorded.")], gaps: [], nextAction: { label: tr("Start a development plan"), href: "/development-plan" } };
  }
  const evidence: string[] = [];
  const gaps: string[] = [];
  if (c.targetRoleTitle) evidence.push(tr("Target role: {role}.", { role: c.targetRoleTitle }));
  if (c.targetSummary && c.targetSummary.required > 0) {
    evidence.push(tr("{met} of {required} target-role competencies already met.", { met: c.targetSummary.met, required: c.targetSummary.required }));
    const open = c.targetSummary.required - c.targetSummary.met;
    if (open) gaps.push(tr("{count, plural, one {# competency} other {# competencies}} to develop for the target role.", { count: open }));
  }
  let action = false;
  const agreed = c.plan && ["AGREED", "IN_PROGRESS", "COMPLETED"].includes(c.plan.status);
  if (!c.plan) {
    gaps.push(tr("No development plan has been created."));
    action = true;
  } else {
    const statusLabel = c.plan.status in PLAN_STATUS_LABEL ? PLAN_STATUS_LABEL[c.plan.status as PlanStatus] : c.plan.status.replace(/_/g, " ");
    evidence.push(tr("Development plan status: {status}; {completed} of {total} objectives completed.", { status: statusLabel.toLowerCase(), completed: c.plan.objectivesCompleted, total: c.plan.objectivesTotal }));
    if (!agreed) {
      gaps.push(tr("The development plan has not yet been agreed with your manager."));
      action = true;
    }
    if (c.plan.objectivesOverdue) {
      gaps.push(tr("{count, plural, one {# objective is} other {# objectives are}} past the target date.", { count: c.plan.objectivesOverdue }));
      action = true;
    }
    const stale = !c.plan.lastReviewedAt || i.now.getTime() - c.plan.lastReviewedAt.getTime() > days(r.planReviewMonths * 30.44);
    if (stale) gaps.push(tr("The plan has not been reviewed in the last {months} months.", { months: r.planReviewMonths }));
  }
  if (!c.targetRoleTitle) gaps.push(tr("No target role is recorded on your profile."));
  const status: HealthStatus = action ? "ACTION" : gaps.length ? "ATTENTION" : "ON_TRACK";
  return { ...base, status, evidence, gaps, nextAction: { label: c.plan ? tr("Open development plan") : tr("Start a development plan"), href: "/development-plan" } };
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
