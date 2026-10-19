export const NOTIFICATION_TYPES = [
  { type: "ASSIGNMENT_NEW", label: "New learning assignments" },
  { type: "DEADLINE_APPROACHING", label: "Approaching deadlines and certificate expiry" },
  { type: "MANDATORY_OVERDUE", label: "Overdue mandatory training" },
  { type: "WEBINAR_REGISTERED", label: "Webinar registration confirmations" },
  { type: "WEBINAR_UPCOMING", label: "Upcoming webinar reminders" },
  { type: "COURSE_COMPLETED", label: "Course completions" },
  { type: "ASSESSMENT_RESULT", label: "Assessment results" },
  { type: "CERTIFICATE_ISSUED", label: "Certificates issued" },
  { type: "CPD_DECISION", label: "CPD approval decisions" },
  { type: "COMPETENCY_REVIEW", label: "Competency reviews" },
  { type: "PLAN_REVIEW", label: "Development plan reviews" },
  { type: "ENROLMENT_DECISION", label: "Enrolment requests and decisions" },
] as const;
