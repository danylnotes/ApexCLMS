import type { Tone } from "@/components/ui";
import { tr } from "@/i18n/active";

/** Label maps translate on read, so every call site shows the current request's language. */
export function translated<T extends string | [string, Tone]>(map: Record<string, T>): Record<string, T> {
  const tx = (v: T) => (typeof v === "string" ? tr(v) : [tr(v[0]), v[1]]) as T;
  return new Proxy(map, {
    get: (target, key) => (typeof key === "string" && key in target ? tx(target[key]) : Reflect.get(target, key)),
  });
}
import type { HealthStatus } from "@/lib/domain/health";

export const HEALTH_TONE: Record<HealthStatus, Tone> = { ON_TRACK: "ok", ATTENTION: "warn", ACTION: "crit", INSUFFICIENT: "idle" };

export const ENROLLMENT: Record<string, [string, Tone]>= translated({
  ACTIVE: ["In progress", "info"],
  COMPLETED: ["Completed", "ok"],
  PENDING_APPROVAL: ["Awaiting approval", "warn"],
  WITHDRAWN: ["Withdrawn", "idle"],
  REJECTED: ["Not approved", "idle"],
});

export const CPD_STATUS: Record<string, [string, Tone]>= translated({
  DRAFT: ["Draft", "idle"],
  SUBMITTED: ["Submitted", "info"],
  UNDER_REVIEW: ["Under review", "warn"],
  APPROVED: ["Approved", "ok"],
  REJECTED: ["Rejected", "crit"],
});

export const COURSE_STATUS: Record<string, [string, Tone]>= translated({
  DRAFT: ["Draft", "idle"],
  IN_REVIEW: ["In review", "warn"],
  PUBLISHED: ["Published", "ok"],
  ARCHIVED: ["Archived", "idle"],
});

export const MANDATORY: Record<string, [string, Tone]>= translated({
  COMPLETED: ["Completed", "ok"],
  OVERDUE: ["Overdue", "crit"],
  DUE_SOON: ["Due soon", "warn"],
  PENDING: ["Not yet due", "info"],
});

export const COMPETENCY: Record<string, [string, Tone]>= translated({
  MET: ["Meets requirement", "ok"],
  GAP: ["Development gap", "warn"],
  NOT_ASSESSED: ["Not yet assessed", "idle"],
  EXPIRED: ["Reassessment due", "crit"],
});

export const WEBINAR_PHASE: Record<string, [string, Tone]>= translated({
  UPCOMING: ["Upcoming", "info"],
  LIVE: ["Live now", "copper"],
  COMPLETED: ["Completed", "idle"],
  CANCELLED: ["Cancelled", "crit"],
  DRAFT: ["Draft", "idle"],
});

export const PLAN_TONE: Record<string, Tone> = {
  DRAFT: "idle",
  EMPLOYEE_REVIEW: "info",
  MANAGER_REVIEW: "warn",
  AGREED: "ok",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
};

export const DIFFICULTY: Record<string, string>= translated({ FOUNDATION: "Foundation", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", EXPERT: "Expert" });
export const DELIVERY: Record<string, string>= translated({ SELF_PACED: "Self-paced online", INSTRUCTOR_LED: "Instructor-led", BLENDED: "Blended", VIRTUAL_CLASSROOM: "Virtual classroom" });
export const ENROLMENT_RULE: Record<string, string>= translated({ OPEN: "Open enrolment", APPROVAL_REQUIRED: "Manager approval required", ASSIGNED_ONLY: "By assignment only" });
export const LESSON_TYPE: Record<string, string>= translated({ TEXT: "Reading", VIDEO: "Video", PDF: "PDF reading", DOCUMENT: "Document", EXTERNAL: "External resource", ASSESSMENT: "Assessment", ASSIGNMENT: "Practical assignment" });
