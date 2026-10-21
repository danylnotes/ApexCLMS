import { requirePagePermission } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { CourseDetailsForm } from "../../course-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("New course") };
}

export default async function NewCourse() {
  await requirePagePermission("course.manage");
  const { t } = await getI18n();
  return (
    <div className="max-w-4xl">
      <PageHeader crumbs={[{ label: t("Course Management"), href: "/admin/courses" }, { label: t("New course") }]} eyebrow={t("Administration")} title={t("Create a course")} description={t("Courses are created as drafts. Add modules, lessons and assessments, configure completion rules, then publish.")} />
      <Panel><CourseDetailsForm /></Panel>
    </div>
  );
}
