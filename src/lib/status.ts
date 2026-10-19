import type { Tone } from "@/components/ui";
import type { HealthStatus } from "@/lib/domain/health";

export const HEALTH_TONE: Record<HealthStatus, Tone> = { ON_TRACK: "ok", ATTENTION: "warn", ACTION: "crit", INSUFFICIENT: "idle" };

export const ENROLLMENT: Record<string, [string, Tone]> = {
  ACTIVE: ["In progress", "info"],
  COMPLETED: ["Completed", "ok"],
  PENDING_APPROVAL: ["Awaiting approval", "warn"],
  WITHDRAWN: ["Withdrawn", "idle"],
  REJECTED: ["Not approved", "idle"],
};

export const CPD_STATUS: Record<string, [string, Tone]> = {
  DRAFT: ["Draft", "idle"],
  SUBMITTED: ["Submitted", "info"],
  UNDER_REVIEW: ["Under review", "warn"],
  APPROVED: ["Approved", "ok"],
  REJECTED: ["Rejected", "crit"],
};

export const COURSE_STATUS: Record<string, [string, Tone]> = {
  DRAFT: ["Draft", "idle"],
  IN_REVIEW: ["In review", "warn"],
  PUBLISHED: ["Published", "ok"],
  ARCHIVED: ["Archived", "idle"],
};

export const MANDATORY: Record<string, [string, Tone]> = {
  COMPLETED: ["Completed", "ok"],
  OVERDUE: ["Overdue", "crit"],
  DUE_SOON: ["Due soon", "warn"],
  PENDING: ["Not yet due", "info"],
};

export const COMPETENCY: Record<string, [string, Tone]> = {
  MET: ["Meets requirement", "ok"],
  GAP: ["Development gap", "warn"],
  NOT_ASSESSED: ["Not yet assessed", "idle"],
  EXPIRED: ["Reassessment due", "crit"],
};

export const WEBINAR_PHASE: Record<string, [string, Tone]> = {
  UPCOMING: ["Upcoming", "info"],
  LIVE: ["Live now", "copper"],
  COMPLETED: ["Completed", "idle"],
  CANCELLED: ["Cancelled", "crit"],
  DRAFT: ["Draft", "idle"],
};

export const PLAN_TONE: Record<string, Tone> = {
  DRAFT: "idle",
  EMPLOYEE_REVIEW: "info",
  MANAGER_REVIEW: "warn",
  AGREED: "ok",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
};

export const DIFFICULTY: Record<string, string> = { FOUNDATION: "Foundation", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", EXPERT: "Expert" };
export const DELIVERY: Record<string, string> = { SELF_PACED: "Self-paced online", INSTRUCTOR_LED: "Instructor-led", BLENDED: "Blended", VIRTUAL_CLASSROOM: "Virtual classroom" };
export const ENROLMENT_RULE: Record<string, string> = { OPEN: "Open enrolment", APPROVAL_REQUIRED: "Manager approval required", ASSIGNED_ONLY: "By assignment only" };
export const LESSON_TYPE: Record<string, string> = { TEXT: "Reading", VIDEO: "Video", PDF: "PDF reading", DOCUMENT: "Document", EXTERNAL: "External resource", ASSESSMENT: "Assessment", ASSIGNMENT: "Practical assignment" };
