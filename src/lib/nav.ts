import type { Permission } from "@/server/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  match?: string;
}
export interface NavGroup {
  label: string;
  anyOf?: Permission[];
  items: (NavItem & { anyOf?: Permission[] })[];
}

export const NAV: NavGroup[] = [
  {
    label: "Learning",
    anyOf: ["learning.self"],
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
      { label: "My Learning", href: "/my-learning", icon: "BookOpen", match: "/learn" },
      { label: "Course Catalogue", href: "/catalogue", icon: "Library", match: "/courses" },
      { label: "Learning Paths", href: "/learning-paths", icon: "Route" },
      { label: "Webinars & Events", href: "/webinars", icon: "Presentation" },
      { label: "Notifications", href: "/notifications", icon: "Bell" },
    ],
  },
  {
    label: "Development",
    anyOf: ["learning.self"],
    items: [
      { label: "Career Development", href: "/career", icon: "Compass" },
      { label: "Competency Profile", href: "/competencies", icon: "Target" },
      { label: "Development Plan", href: "/development-plan", icon: "ClipboardList" },
      { label: "My CPD", href: "/cpd", icon: "Award" },
      { label: "Certificates", href: "/certificates", icon: "BadgeCheck" },
      { label: "Learning History", href: "/history", icon: "History" },
    ],
  },
  {
    label: "Teaching",
    anyOf: ["course.teach"],
    items: [{ label: "Teaching Workspace", href: "/teaching", icon: "GraduationCap" }],
  },
  {
    label: "Management",
    anyOf: ["team.view"],
    items: [
      { label: "Manager Dashboard", href: "/manager", icon: "Gauge" },
      { label: "Team Learning", href: "/manager/team", icon: "Users" },
      { label: "Assign Learning", href: "/manager/assign", icon: "Send" },
      { label: "Competency Gaps", href: "/manager/gaps", icon: "Grid3x3" },
      { label: "Team Reports", href: "/manager/reports", icon: "FileBarChart" },
    ],
  },
  {
    label: "Insights",
    anyOf: ["analytics.aggregate"],
    items: [{ label: "Organisational Insights", href: "/insights", icon: "LineChart" }],
  },
  {
    label: "Administration",
    anyOf: ["course.manage", "user.manage", "settings.manage", "webinar.manage", "cpd.approve", "competency.manage", "audit.view"],
    items: [
      { label: "Overview", href: "/admin", icon: "Building2", anyOf: ["course.manage", "user.manage", "settings.manage"] },
      { label: "Courses", href: "/admin/courses", icon: "BookMarked", anyOf: ["course.manage"] },
      { label: "Assessments", href: "/admin/assessments", icon: "ListChecks", anyOf: ["assessment.manage", "course.manage"] },
      { label: "Learning Paths", href: "/admin/paths", icon: "Route", anyOf: ["course.manage"] },
      { label: "Webinars", href: "/admin/webinars", icon: "Presentation", anyOf: ["webinar.manage"] },
      { label: "Competency Frameworks", href: "/admin/competencies", icon: "Target", anyOf: ["competency.manage"] },
      { label: "CPD", href: "/admin/cpd", icon: "Award", anyOf: ["cpd.approve", "cpd.configure"] },
      { label: "Users & Organisation", href: "/admin/users", icon: "Users", anyOf: ["user.manage"] },
      { label: "Roles & Permissions", href: "/admin/roles", icon: "ShieldCheck", anyOf: ["role.manage"] },
      { label: "Certificates", href: "/admin/certificates", icon: "BadgeCheck", anyOf: ["certificate.manage"] },
      { label: "Reports & Analytics", href: "/admin/reports", icon: "FileBarChart", anyOf: ["reports.org"] },
      { label: "Audit Log", href: "/admin/audit", icon: "ScrollText", anyOf: ["audit.view"] },
      { label: "Configuration", href: "/admin/settings", icon: "Settings", anyOf: ["settings.manage"] },
    ],
  },
];

export function navFor(perms: Set<string>): NavGroup[] {
  return NAV.filter((g) => !g.anyOf || g.anyOf.some((p) => perms.has(p)))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.anyOf || i.anyOf.some((p) => perms.has(p))) }))
    .filter((g) => g.items.length);
}
