/** Canonical permission catalogue. Role assignments are stored in the database and editable by administrators. */
export const PERMISSIONS = {
  "learning.self": { group: "Learning", description: "Use personal learning features (catalogue, courses, CPD, development plan)" },
  "team.view": { group: "Management", description: "View learning and development records of employees within reporting scope" },
  "team.assign": { group: "Management", description: "Assign or recommend learning to employees within reporting scope" },
  "plan.review": { group: "Management", description: "Review and agree development plans within reporting scope" },
  "competency.assess": { group: "Management", description: "Record competency assessments for employees within scope" },
  "enrolment.approve": { group: "Management", description: "Approve enrolment requests within scope" },
  "course.teach": { group: "Instruction", description: "Manage content, submissions and attendance for assigned courses and webinars" },
  "course.manage": { group: "Administration", description: "Create, edit, publish and archive any course or learning path" },
  "webinar.manage": { group: "Administration", description: "Schedule and manage webinars, verify attendance, process CPD" },
  "assessment.manage": { group: "Administration", description: "Create and manage assessments" },
  "cpd.approve": { group: "Administration", description: "Review, approve and reject CPD claims" },
  "cpd.configure": { group: "Administration", description: "Configure CPD policies and reporting periods" },
  "competency.manage": { group: "Administration", description: "Manage competency frameworks, levels and role requirements" },
  "mandatory.assign": { group: "Administration", description: "Assign mandatory training to any audience" },
  "certificate.manage": { group: "Administration", description: "Manage certificate templates and revoke certificates" },
  "user.manage": { group: "Administration", description: "Create, invite, deactivate users; manage departments and roles" },
  "role.manage": { group: "Administration", description: "Edit role permissions" },
  "reports.org": { group: "Reporting", description: "Generate organisation-wide reports including individual records" },
  "analytics.aggregate": { group: "Reporting", description: "View aggregated organisational analytics" },
  "audit.view": { group: "Administration", description: "View the audit log" },
  "settings.manage": { group: "Administration", description: "Manage platform configuration and branding" },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_DEFAULTS: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  EMPLOYEE: { name: "Employee", description: "Personal learning, CPD and development planning", permissions: ["learning.self"] },
  MANAGER: {
    name: "Line Manager",
    description: "Team oversight within reporting scope",
    permissions: ["learning.self", "team.view", "team.assign", "plan.review", "competency.assess", "enrolment.approve"],
  },
  INSTRUCTOR: { name: "Instructor", description: "Assigned course delivery and assessment", permissions: ["learning.self", "course.teach"] },
  LD_ADMIN: {
    name: "L&D Administrator",
    description: "Learning content, programmes and organisational reporting",
    permissions: [
      "learning.self", "course.manage", "webinar.manage", "assessment.manage", "cpd.approve", "cpd.configure",
      "competency.manage", "competency.assess", "mandatory.assign", "certificate.manage", "user.manage", "role.manage",
      "reports.org", "analytics.aggregate", "audit.view", "settings.manage", "enrolment.approve", "course.teach",
    ],
  },
  EXECUTIVE: { name: "Executive / HR Leadership", description: "Aggregated organisational intelligence", permissions: ["learning.self", "analytics.aggregate"] },
};
