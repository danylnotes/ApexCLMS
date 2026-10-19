export type MandatoryState = "COMPLETED" | "OVERDUE" | "DUE_SOON" | "PENDING";

export interface MandatoryItem {
  dueDate: Date | null;
  completedAt: Date | null;
}

export function mandatoryState(item: MandatoryItem, now: Date = new Date(), dueSoonDays = 30): MandatoryState {
  if (item.completedAt) return "COMPLETED";
  if (!item.dueDate) return "PENDING";
  const ms = item.dueDate.getTime() - now.getTime();
  if (ms < 0) return "OVERDUE";
  if (ms <= dueSoonDays * 86_400_000) return "DUE_SOON";
  return "PENDING";
}

export interface ComplianceSummary {
  total: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  pending: number;
  /**
   * Completed ÷ (completed + overdue): the share of mandatory items that have fallen due
   * and were completed. Items not yet due are excluded. Null when nothing has fallen due.
   */
  ratePercent: number | null;
}

export function summarizeCompliance(items: MandatoryItem[], now: Date = new Date(), dueSoonDays = 30): ComplianceSummary {
  const s: ComplianceSummary = { total: items.length, completed: 0, overdue: 0, dueSoon: 0, pending: 0, ratePercent: null };
  for (const i of items) {
    const st = mandatoryState(i, now, dueSoonDays);
    if (st === "COMPLETED") s.completed++;
    else if (st === "OVERDUE") s.overdue++;
    else if (st === "DUE_SOON") s.dueSoon++;
    else s.pending++;
  }
  const denom = s.completed + s.overdue;
  s.ratePercent = denom === 0 ? null : Math.round((s.completed / denom) * 100);
  return s;
}

export const COMPLIANCE_METHOD =
  "Completed mandatory items ÷ mandatory items that are completed or past their due date. Items not yet due are excluded.";
