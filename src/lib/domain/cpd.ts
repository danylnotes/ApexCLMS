export type CpdClaimStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type CpdUnit = "HOURS" | "POINTS";

/** Draft → Submitted → Under Review → Approved | Rejected. A rejected claim may be revised back to draft. */
const TRANSITIONS: Record<CpdClaimStatus, CpdClaimStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "DRAFT"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
};

export function allowedCpdTransitions(from: CpdClaimStatus): CpdClaimStatus[] {
  return TRANSITIONS[from];
}

export class CpdTransitionError extends Error {}

export function assertCpdTransition(
  from: CpdClaimStatus,
  to: CpdClaimStatus,
  opts: { reason?: string | null; approvedValue?: number | null; claimedValue?: number } = {},
): void {
  if (!TRANSITIONS[from].includes(to)) throw new CpdTransitionError(`A claim cannot move from ${from} to ${to}.`);
  if (to === "REJECTED" && !opts.reason?.trim()) throw new CpdTransitionError("A rejection reason is required.");
  if (to === "APPROVED") {
    const v = opts.approvedValue;
    if (v == null || !(v > 0)) throw new CpdTransitionError("An approved value greater than zero is required.");
    if (opts.claimedValue != null && v > opts.claimedValue)
      throw new CpdTransitionError("The approved value cannot exceed the value claimed.");
  }
}

export interface CpdPolicyRule {
  unit: CpdUnit;
  targetPerPeriod: number | null;
  pointsPerHour: number | null;
  maxPerActivity: number | null;
}

/** Converts recorded activity hours into the policy unit and applies the per-activity cap. */
export function claimableValue(durationHours: number, policy: CpdPolicyRule | null): number {
  if (!(durationHours > 0)) return 0;
  let v = durationHours;
  if (policy?.unit === "POINTS") v = durationHours * (policy.pointsPerHour ?? 1);
  if (policy?.maxPerActivity != null) v = Math.min(v, policy.maxPerActivity);
  return round2(v);
}

export interface ClaimLike {
  status: CpdClaimStatus;
  claimedValue: number;
  approvedValue: number | null;
}

export interface CpdSummary {
  approved: number;
  pending: number;
  pendingCount: number;
  rejectedCount: number;
  draftCount: number;
  target: number | null;
  remaining: number | null;
  percentOfTarget: number | null;
  /** Expected approved value by now if progressing evenly through the period. */
  proRataExpected: number | null;
  periodElapsedPercent: number;
}

export function summarizeCpd(
  claims: ClaimLike[],
  target: number | null,
  period: { startDate: Date; endDate: Date },
  now: Date = new Date(),
): CpdSummary {
  let approved = 0;
  let pending = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let draftCount = 0;
  for (const c of claims) {
    if (c.status === "APPROVED") approved += c.approvedValue ?? 0;
    else if (c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") {
      pending += c.claimedValue;
      pendingCount++;
    } else if (c.status === "REJECTED") rejectedCount++;
    else draftCount++;
  }
  const span = period.endDate.getTime() - period.startDate.getTime();
  const elapsed = Math.min(Math.max(now.getTime() - period.startDate.getTime(), 0), span);
  const frac = span > 0 ? elapsed / span : 1;
  return {
    approved: round2(approved),
    pending: round2(pending),
    pendingCount,
    rejectedCount,
    draftCount,
    target,
    remaining: target == null ? null : round2(Math.max(target - approved, 0)),
    percentOfTarget: target ? Math.min(Math.round((approved / target) * 100), 100) : null,
    proRataExpected: target == null ? null : round2(target * frac),
    periodElapsedPercent: Math.round(frac * 100),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
