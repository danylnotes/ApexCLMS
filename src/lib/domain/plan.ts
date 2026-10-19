export type PlanStatus = "DRAFT" | "EMPLOYEE_REVIEW" | "MANAGER_REVIEW" | "AGREED" | "IN_PROGRESS" | "COMPLETED";
export type PlanActor = "OWNER" | "REVIEWER";

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  EMPLOYEE_REVIEW: "Employee Review",
  MANAGER_REVIEW: "Manager Review",
  AGREED: "Agreed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const PLAN_FLOW: PlanStatus[] = ["DRAFT", "EMPLOYEE_REVIEW", "MANAGER_REVIEW", "AGREED", "IN_PROGRESS", "COMPLETED"];

interface Transition {
  to: PlanStatus;
  by: PlanActor;
  label: string;
  requiresComment?: boolean;
}

/** Draft → Employee Review → Manager Review → Agreed → In Progress → Completed, with return paths. */
const TRANSITIONS: Record<PlanStatus, Transition[]> = {
  DRAFT: [{ to: "EMPLOYEE_REVIEW", by: "OWNER", label: "Mark ready for my review" }],
  EMPLOYEE_REVIEW: [
    { to: "MANAGER_REVIEW", by: "OWNER", label: "Submit to manager" },
    { to: "DRAFT", by: "OWNER", label: "Return to draft" },
  ],
  MANAGER_REVIEW: [
    { to: "AGREED", by: "REVIEWER", label: "Agree plan" },
    { to: "DRAFT", by: "REVIEWER", label: "Request changes", requiresComment: true },
  ],
  AGREED: [{ to: "IN_PROGRESS", by: "OWNER", label: "Start plan" }],
  IN_PROGRESS: [
    { to: "COMPLETED", by: "REVIEWER", label: "Confirm completion", requiresComment: true },
    { to: "MANAGER_REVIEW", by: "OWNER", label: "Submit revision for review" },
  ],
  COMPLETED: [],
};

export function availablePlanTransitions(status: PlanStatus, actor: PlanActor): Transition[] {
  return TRANSITIONS[status].filter((t) => t.by === actor);
}

export function checkPlanTransition(from: PlanStatus, to: PlanStatus, actor: PlanActor, opts: { comment?: string | null; objectives: number }): string | null {
  const t = TRANSITIONS[from].find((x) => x.to === to);
  if (!t) return `A plan cannot move from ${PLAN_STATUS_LABEL[from]} to ${PLAN_STATUS_LABEL[to]}.`;
  if (t.by !== actor) return actor === "OWNER" ? "This step must be completed by the reviewing manager." : "This step must be completed by the employee.";
  if (t.requiresComment && !opts.comment?.trim()) return "A comment is required for this step.";
  if ((to === "MANAGER_REVIEW" || to === "AGREED") && opts.objectives === 0) return "Add at least one development objective first.";
  return null;
}

/** Whether objectives may be edited by the owner in a given status. */
export const ownerCanEdit = (s: PlanStatus) => s === "DRAFT" || s === "EMPLOYEE_REVIEW";
