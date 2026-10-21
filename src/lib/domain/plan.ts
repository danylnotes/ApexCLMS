import { tr } from "@/i18n/active";

export type PlanStatus = "DRAFT" | "EMPLOYEE_REVIEW" | "MANAGER_REVIEW" | "AGREED" | "IN_PROGRESS" | "COMPLETED";
export type PlanActor = "OWNER" | "REVIEWER";

/** Label maps translate on read, so every call site shows the current request's language. */
function translated<K extends string>(map: Record<K, string>): Record<K, string> {
  return new Proxy(map, {
    get: (target, key) => (typeof key === "string" && key in target ? tr(target[key as K]) : Reflect.get(target, key)),
  });
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = translated({
  DRAFT: "Draft",
  EMPLOYEE_REVIEW: "Employee Review",
  MANAGER_REVIEW: "Manager Review",
  AGREED: "Agreed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
});

/** Development objective statuses. */
export const OBJECTIVE_STATUS_LABEL: Record<string, string> = translated({
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
});

/** Planned learning activity types. */
export const PLAN_ACTION_TYPE_LABEL: Record<string, string> = translated({
  COURSE: "Course",
  ON_THE_JOB: "On the job",
  MENTORING: "Mentoring",
  PROJECT: "Project",
  WEBINAR: "Webinar",
  OTHER: "Other",
});

/** 70-20-10 planning model labels. */
export const LEARNING_MODEL_LABEL: Record<string, string> = translated({
  EXPERIENTIAL: "Experiential (on the job)",
  SOCIAL: "Learning from others",
  FORMAL: "Formal learning",
});

export const PLAN_FLOW: PlanStatus[] = ["DRAFT", "EMPLOYEE_REVIEW", "MANAGER_REVIEW", "AGREED", "IN_PROGRESS", "COMPLETED"];

interface Transition {
  to: PlanStatus;
  by: PlanActor;
  /** English source text; translate with tr()/t() when rendering. */
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
  if (!t) return tr("A plan cannot move from {from} to {to}.", { from: PLAN_STATUS_LABEL[from], to: PLAN_STATUS_LABEL[to] });
  if (t.by !== actor) return actor === "OWNER" ? tr("This step must be completed by the reviewing manager.") : tr("This step must be completed by the employee.");
  if (t.requiresComment && !opts.comment?.trim()) return tr("A comment is required for this step.");
  if ((to === "MANAGER_REVIEW" || to === "AGREED") && opts.objectives === 0) return tr("Add at least one development objective first.");
  return null;
}

/** Whether objectives may be edited by the owner in a given status. */
export const ownerCanEdit = (s: PlanStatus) => s === "DRAFT" || s === "EMPLOYEE_REVIEW";
