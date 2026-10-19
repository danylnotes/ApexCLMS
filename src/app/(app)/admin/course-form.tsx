import type { Course } from "@prisma/client";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { DELIVERY, DIFFICULTY } from "@/lib/status";
import { createCourseAction, updateCourseAction } from "../staff-actions";

export async function CourseDetailsForm({ course, departmentIds = [] }: { course?: Course; departmentIds?: string[] }) {
  const [categories, departments] = await Promise.all([prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), prisma.department.findMany({ orderBy: { name: "asc" } })]);
  return (
    <ActionForm action={course ? updateCourseAction : createCourseAction} className="grid gap-5 md:grid-cols-2">
      {course && <input type="hidden" name="courseId" value={course.id} />}
      <Field label="Course code" htmlFor="code" hint="e.g. PSM-101" required><input id="code" name="code" defaultValue={course?.code} required className="input-base uppercase" /></Field>
      <Field label="Category" htmlFor="categoryId" required><select id="categoryId" name="categoryId" defaultValue={course?.categoryId} className="input-base">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <div className="md:col-span-2"><Field label="Title" htmlFor="title" required><input id="title" name="title" defaultValue={course?.title} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Synopsis" htmlFor="synopsis" hint="One or two sentences shown in the catalogue." required><textarea id="synopsis" name="synopsis" rows={2} defaultValue={course?.synopsis} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Overview" htmlFor="overview" hint="Separate paragraphs with a blank line." required><textarea id="overview" name="overview" rows={5} defaultValue={course?.overview} required className="input-base" /></Field></div>
      <Field label="Business relevance" htmlFor="businessRelevance"><textarea id="businessRelevance" name="businessRelevance" rows={3} defaultValue={course?.businessRelevance ?? ""} className="input-base" /></Field>
      <Field label="Intended audience" htmlFor="intendedAudience"><textarea id="intendedAudience" name="intendedAudience" rows={3} defaultValue={course?.intendedAudience ?? ""} className="input-base" /></Field>
      <Field label="Learning objectives" htmlFor="objectives" hint="One per line."><textarea id="objectives" name="objectives" rows={5} defaultValue={course?.objectives.join("\n")} className="input-base" /></Field>
      <Field label="Expected outcomes" htmlFor="outcomes" hint="One per line."><textarea id="outcomes" name="outcomes" rows={5} defaultValue={course?.outcomes.join("\n")} className="input-base" /></Field>
      <Field label="Prerequisites (description)" htmlFor="prerequisitesText"><input id="prerequisitesText" name="prerequisitesText" defaultValue={course?.prerequisitesText ?? ""} className="input-base" /></Field>
      <Field label="Search keywords" htmlFor="keywords" hint="Comma-separated."><input id="keywords" name="keywords" defaultValue={course?.keywords.join(", ")} className="input-base" /></Field>
      <Field label="Difficulty" htmlFor="difficulty"><select id="difficulty" name="difficulty" defaultValue={course?.difficulty} className="input-base">{Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Delivery mode" htmlFor="deliveryMode"><select id="deliveryMode" name="deliveryMode" defaultValue={course?.deliveryMode} className="input-base">{Object.entries(DELIVERY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Provider" htmlFor="provider" required><input id="provider" name="provider" defaultValue={course?.provider ?? "Internal — Learning & Development"} required className="input-base" /></Field>
      <Field label="Estimated study hours" htmlFor="estimatedHours" hint="Study time does not determine CPD." required><input id="estimatedHours" name="estimatedHours" type="number" step="0.25" min="0.25" defaultValue={course ? Number(course.estimatedHours) : ""} required className="input-base" /></Field>
      <fieldset className="md:col-span-2">
        <legend className="font-sans text-[0.8125rem] font-medium">Relevant departments</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-3">{departments.map((d) => <label key={d.id} className="flex items-center gap-2 text-[0.875rem]"><input type="checkbox" name="departmentIds" value={d.id} defaultChecked={departmentIds.includes(d.id)} className="h-4 w-4 accent-[rgb(22,38,68)]" />{d.name}</label>)}</div>
      </fieldset>
      <div><SubmitButton>{course ? "Save details" : "Create draft course"}</SubmitButton></div>
    </ActionForm>
  );
}
