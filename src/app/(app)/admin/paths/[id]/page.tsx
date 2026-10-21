import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, PageHeader, Panel, Status, Table, Td, Th } from "@/components/ui";
import { COURSE_STATUS } from "@/lib/status";
import { fmtHours } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { pathAction } from "../../../staff-actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Edit learning path") };
}

export default async function PathEditor({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("course.manage");
  const { id } = await params;
  const { t } = await getI18n();
  const isNew = id === "new";
  const path = isNew ? null : await prisma.learningPath.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" }, include: { course: true, prerequisiteItem: { include: { course: true } } } }, competencies: true } });
  if (!isNew && !path) notFound();
  const [roles, competencies, courses] = await Promise.all([prisma.jobRole.findMany({ orderBy: { title: "asc" } }), prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }), prisma.course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { code: "asc" } })]);
  const statusBtn = (to: string, text: string) => <ActionForm action={pathAction} inline><input type="hidden" name="pathId" value={id} /><input type="hidden" name="op" value="status" /><input type="hidden" name="to" value={to} /><SubmitButton variant={to === "PUBLISHED" ? "primary" : "secondary"}>{text}</SubmitButton></ActionForm>;
  return (
    <div>
      <PageHeader crumbs={[{ label: t("Learning paths"), href: "/admin/paths" }, { label: path?.title ?? t("New") }]} eyebrow={t("Administration")} title={path?.title ?? t("New learning path")} meta={path && <><Status tone={COURSE_STATUS[path.status][1]}>{COURSE_STATUS[path.status][0]}</Status><span>{t("{hours} expected study", { hours: fmtHours(path.expectedHours.toString()) })}</span></>} actions={path && (path.status === "PUBLISHED" ? statusBtn("DRAFT", t("Unpublish")) : statusBtn("PUBLISHED", t("Publish")))} />
      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title={t("Path definition")}>
          <ActionForm action={pathAction} className="grid gap-4 sm:grid-cols-2">
            {path && <input type="hidden" name="pathId" value={path.id} />}<input type="hidden" name="op" value="save" />
            <Field label={t("Code")} htmlFor="code" required><input id="code" name="code" defaultValue={path?.code} required className="input-base uppercase" /></Field>
            <Field label={t("Target job role")} htmlFor="targetJobRoleId"><select id="targetJobRoleId" name="targetJobRoleId" defaultValue={path?.targetJobRoleId ?? ""} className="input-base"><option value="">—</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label={t("Title")} htmlFor="title" required><input id="title" name="title" defaultValue={path?.title} required className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Summary")} htmlFor="summary" required><textarea id="summary" name="summary" rows={2} defaultValue={path?.summary} required className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Target audience")} htmlFor="targetAudience" required><input id="targetAudience" name="targetAudience" defaultValue={path?.targetAudience} required className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Entry requirements")} htmlFor="entryRequirements"><input id="entryRequirements" name="entryRequirements" defaultValue={path?.entryRequirements ?? ""} className="input-base" /></Field></div>
            <div className="sm:col-span-2"><Field label={t("Completion criteria")} htmlFor="completionCriteria" required><textarea id="completionCriteria" name="completionCriteria" rows={2} defaultValue={path?.completionCriteria ?? "Complete all required courses, including their assessments."} required className="input-base" /></Field></div>
            <Field label={t("Estimated duration (weeks)")} htmlFor="estimatedDurationWeeks"><input id="estimatedDurationWeeks" name="estimatedDurationWeeks" type="number" min={1} defaultValue={path?.estimatedDurationWeeks ?? ""} className="input-base" /></Field>
            <label className="flex items-end gap-2 pb-2 font-sans text-sm"><input type="checkbox" name="cpdEligible" defaultChecked={path?.cpdEligible ?? true} className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("CPD-eligible courses")}</label>
            <div className="sm:col-span-2"><Field label={t("Relevant competencies")} htmlFor="competencyIds"><select id="competencyIds" name="competencyIds" multiple size={6} defaultValue={path?.competencies.map((c) => c.competencyId)} className="input-base">{competencies.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></Field></div>
            <div><SubmitButton>{path ? t("Save") : t("Create path")}</SubmitButton></div>
          </ActionForm>
        </Panel>
        {path && (
          <Panel title={t("Courses in this path")} description={t("Mandatory components are required; optional items are enrichment. Prerequisites set the order.")} bodyClassName="pt-0">
            <Table caption={t("Path items")}><thead><tr><Th>#</Th><Th>{t("Course")}</Th><Th>{t("Type")}</Th><Th>{t("After")}</Th><Th /></tr></thead>
              <tbody>{path.items.map((i, n) => <tr key={i.id}><Td>{n + 1}</Td><Td>{i.course.code} {i.course.title}{i.course.status !== "PUBLISHED" && <span className="type-meta"> {t("(not published)")}</span>}</Td><Td>{i.isRequired ? t("Required") : t("Optional")}</Td><Td>{i.prerequisiteItem?.course.code ?? "—"}</Td><Td align="right"><ActionForm action={pathAction} inline><input type="hidden" name="pathId" value={path.id} /><input type="hidden" name="op" value="removeItem" /><input type="hidden" name="itemId" value={i.id} /><SubmitButton size="sm" variant="ghost">{t("Remove")}</SubmitButton></ActionForm></Td></tr>)}</tbody>
            </Table>
            <ActionForm action={pathAction} className="mt-4 grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="pathId" value={path.id} /><input type="hidden" name="op" value="addItem" />
              <Field label={t("Course")} htmlFor="courseId"><select id="courseId" name="courseId" className="input-base">{courses.filter((c) => !path.items.some((i) => i.courseId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></Field>
              <Field label={t("Prerequisite within path")} htmlFor="prerequisiteItemId"><select id="prerequisiteItemId" name="prerequisiteItemId" className="input-base"><option value="">{t("None")}</option>{path.items.map((i) => <option key={i.id} value={i.id}>{i.course.code}</option>)}</select></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="isRequired" defaultChecked className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Required")}</label>
              <div><SubmitButton size="sm">{t("Add course")}</SubmitButton></div>
            </ActionForm>
          </Panel>
        )}
      </div>
    </div>
  );
}
