import { requirePagePermission } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/ui";
import { CourseDetailsForm } from "../../course-form";

export const metadata = { title: "New course" };

export default async function NewCourse() {
  await requirePagePermission("course.manage");
  return (
    <div className="max-w-4xl">
      <PageHeader crumbs={[{ label: "Course Management", href: "/admin/courses" }, { label: "New course" }]} eyebrow="Administration" title="Create a course" description="Courses are created as drafts. Add modules, lessons and assessments, configure completion rules, then publish." />
      <Panel><CourseDetailsForm /></Panel>
    </div>
  );
}
