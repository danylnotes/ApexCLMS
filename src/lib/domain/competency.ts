export type EvidenceBasis = "KNOWLEDGE" | "DEMONSTRATED";
export type CompetencyStatus = "MET" | "GAP" | "NOT_ASSESSED" | "EXPIRED";

export interface CurrentAssessment {
  level: number;
  basis: EvidenceBasis;
  assessedAt: Date;
  reassessmentDue: Date | null;
}

export interface CompetencyEvaluation {
  status: CompetencyStatus;
  requiredLevel: number;
  /** Level recorded on the latest current assessment. */
  recordedLevel: number | null;
  /** Level that counts towards the role requirement. */
  effectiveLevel: number;
  gap: number;
  /** Evidence is knowledge-only and the framework does not accept it as demonstrated competence. */
  knowledgeOnly: boolean;
}

/**
 * Compares a person's current assessment against a role requirement.
 * Knowledge-only evidence counts only when the framework explicitly allows it.
 * Expired assessments (past reassessment date) do not count.
 */
export function evaluateCompetency(
  requiredLevel: number,
  current: CurrentAssessment | null,
  opts: { allowKnowledgeAsCompetence: boolean; now?: Date },
): CompetencyEvaluation {
  const now = opts.now ?? new Date();
  if (!current) {
    return { status: "NOT_ASSESSED", requiredLevel, recordedLevel: null, effectiveLevel: 0, gap: requiredLevel, knowledgeOnly: false };
  }
  const knowledgeOnly = current.basis === "KNOWLEDGE" && !opts.allowKnowledgeAsCompetence;
  const expired = current.reassessmentDue != null && current.reassessmentDue.getTime() < now.getTime();
  const effectiveLevel = expired || knowledgeOnly ? 0 : current.level;
  const gap = Math.max(requiredLevel - effectiveLevel, 0);
  let status: CompetencyStatus = gap === 0 ? "MET" : "GAP";
  if (expired) status = "EXPIRED";
  return { status, requiredLevel, recordedLevel: current.level, effectiveLevel, gap, knowledgeOnly };
}

export interface GapSummary {
  required: number;
  assessed: number;
  met: number;
  gaps: number;
  significantGaps: number;
  expired: number;
  notAssessed: number;
  /** Share of required competencies that are met (null when none are required). */
  coveragePercent: number | null;
}

export function summarizeGaps(rows: CompetencyEvaluation[], significantGapLevels = 2): GapSummary {
  const s: GapSummary = { required: rows.length, assessed: 0, met: 0, gaps: 0, significantGaps: 0, expired: 0, notAssessed: 0, coveragePercent: null };
  for (const r of rows) {
    if (r.status !== "NOT_ASSESSED") s.assessed++;
    if (r.status === "MET") s.met++;
    if (r.status === "GAP") s.gaps++;
    if (r.status === "EXPIRED") s.expired++;
    if (r.status === "NOT_ASSESSED") s.notAssessed++;
    if (r.gap >= significantGapLevels) s.significantGaps++;
  }
  s.coveragePercent = rows.length === 0 ? null : Math.round((s.met / rows.length) * 100);
  return s;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}
