import type { Course } from "@prisma/client";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { DELIVERY, DIFFICULTY } from "@/lib/status";
import { getI18n } from "@/i18n/server";
import { createCourseAction, updateCourseAction } from "../staff-actions";

export async function CourseDetailsForm({ course, departmentIds = [], audienceRoleIds = [], canSetAudience = true }: { course?: Course; departmentIds?: string[]; audienceRoleIds?: string[]; canSetAudience?: boolean }) {
  const { t } = await getI18n();
  const [categories, departments, jobRoles] = await Promise.all([prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), prisma.department.findMany({ orderBy: { name: "asc" } }), prisma.jobRole.findMany({ where: { isActive: true }, orderBy: [{ grade: "asc" }, { title: "asc" }] })]);
  return (
    <ActionForm action={course ? updateCourseAction : createCourseAction} className="grid gap-5 md:grid-cols-2">
      {course && <input type="hidden" name="courseId" value={course.id} />}
      <Field label={t("Course code")} htmlFor="code" hint={t("e.g. {example}", { example: "PSM-101" })} required><input id="code" name="code" defaultValue={course?.code} required className="input-base uppercase" /></Field>
      <Field label={t("Category")} htmlFor="categoryId" required><select id="categoryId" name="categoryId" defaultValue={course?.categoryId} className="input-base">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <div className="md:col-span-2"><Field label={t("Title")} htmlFor="title" required><input id="title" name="title" defaultValue={course?.title} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label={t("Synopsis")} htmlFor="synopsis" hint={t("One or two sentences shown in the catalogue.")} required><textarea id="synopsis" name="synopsis" rows={2} defaultValue={course?.synopsis} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label={t("Overview")} htmlFor="overview" hint={t("Separate paragraphs with a blank line.")} required><textarea id="overview" name="overview" rows={5} defaultValue={course?.overview} required className="input-base" /></Field></div>
      <Field label={t("Business relevance")} htmlFor="businessRelevance"><textarea id="businessRelevance" name="businessRelevance" rows={3} defaultValue={course?.businessRelevance ?? ""} className="input-base" /></Field>
      <Field label={t("Intended audience")} htmlFor="intendedAudience"><textarea id="intendedAudience" name="intendedAudience" rows={3} defaultValue={course?.intendedAudience ?? ""} className="input-base" /></Field>
      <Field label={t("Learning objectives")} htmlFor="objectives" hint={t("One per line.")}><textarea id="objectives" name="objectives" rows={5} defaultValue={course?.objectives.join("\n")} className="input-base" /></Field>
      <Field label={t("Expected outcomes")} htmlFor="outcomes" hint={t("One per line.")}><textarea id="outcomes" name="outcomes" rows={5} defaultValue={course?.outcomes.join("\n")} className="input-base" /></Field>
      <Field label={t("Prerequisites (description)")} htmlFor="prerequisitesText"><input id="prerequisitesText" name="prerequisitesText" defaultValue={course?.prerequisitesText ?? ""} className="input-base" /></Field>
      <Field label={t("Search keywords")} htmlFor="keywords" hint={t("Comma-separated.")}><input id="keywords" name="keywords" defaultValue={course?.keywords.join(", ")} className="input-base" /></Field>
      <Field label={t("Difficulty")} htmlFor="difficulty"><select id="difficulty" name="difficulty" defaultValue={course?.difficulty} className="input-base">{Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label={t("Delivery mode")} htmlFor="deliveryMode"><select id="deliveryMode" name="deliveryMode" defaultValue={course?.deliveryMode} className="input-base">{Object.entries(DELIVERY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label={t("Provider")} htmlFor="provider" required><input id="provider" name="provider" defaultValue={course?.provider ?? "Internal — Learning & Development"} required className="input-base" /></Field>
      <Field label={t("Estimated study hours")} htmlFor="estimatedHours" hint={t("Study time does not determine CPD.")} required><input id="estimatedHours" name="estimatedHours" type="number" step="0.25" min="0.25" defaultValue={course ? Number(course.estimatedHours) : ""} required className="input-base" /></Field>
      <fieldset className="md:col-span-2">
        <legend className="font-sans text-[0.8125rem] font-medium">{t("Relevant departments")}</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-3">{departments.map((d) => <label key={d.id} className="flex items-center gap-2 text-[0.875rem]"><input type="checkbox" name="departmentIds" value={d.id} defaultChecked={departmentIds.includes(d.id)} className="h-4 w-4 accent-[rgb(22,38,68)]" />{d.name}</label>)}</div>
      </fieldset>
      <fieldset className="md:col-span-2" disabled={!canSetAudience}>
        <legend className="font-sans text-[0.8125rem] font-medium">{t("Job-title audience")}</legend>
        <p className="type-meta">{t("Only staff granted one of the selected job titles can find and open this course. Leave all unticked to open it to every job title (e.g. site-wide mandatory training).")}{!canSetAudience && ` ${t("Set by L&D administrators.")}`}</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-3">{jobRoles.map((r) => <label key={r.id} className="flex items-center gap-2 text-[0.875rem]"><input type="checkbox" name="audienceRoleIds" value={r.id} defaultChecked={audienceRoleIds.includes(r.id)} className="h-4 w-4 accent-[rgb(22,38,68)]" />{r.title}</label>)}</div>
      </fieldset>
      <div><SubmitButton>{course ? t("Save details") : t("Create draft course")}</SubmitButton></div>
    </ActionForm>
  );
}
