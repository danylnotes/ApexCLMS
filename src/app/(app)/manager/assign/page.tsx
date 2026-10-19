import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can, reportingScope } from "@/server/policy";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { assignAction, cancelAssignmentAction, enrolmentDecisionAction } from "../../staff-actions";

export const metadata = { title: "Learning Assignment" };

export default async function AssignPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePagePermission("team.assign", "mandatory.assign");
  const { tab = "assign" } = await searchParams;
  const isAdmin = can(actor, "mandatory.assign");
  const scope = await reportingScope(actor.id);
  const [people, courses, paths, departments, roles, requests, mine] = await Promise.all([
    prisma.user.findMany({ where: { status: "ACTIVE", ...(isAdmin ? {} : { id: { in: scope } }) }, orderBy: { name: "asc" }, include: { profile: { include: { jobRole: true } } } }),
    prisma.course.findMany({ where: { status: "PUBLISHED" }, orderBy: { code: "asc" } }),
    prisma.learningPath.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ orderBy: { title: "asc" } }),
    prisma.enrollment.findMany({ where: { status: "PENDING_APPROVAL", ...(isAdmin && can(actor, "enrolment.approve") && !can(actor, "team.view") ? {} : { userId: { in: scope } }) }, include: { user: { select: { name: true } }, course: { select: { title: true, code: true } } } }),
    prisma.learningAssignment.findMany({ where: { assignedById: actor.id, status: "ASSIGNED" }, include: { user: { select: { name: true } }, course: { select: { title: true } }, path: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Management" title="Learning Assignment" description={isAdmin ? "Assign required, recommended or mandatory learning to individuals or whole audiences." : "Assign or recommend learning to employees in your reporting line. Mandatory training is assigned by L&D."} />
      <TabNav current={tab} tabs={[{ key: "assign", label: "Assign learning", href: "/manager/assign" }, { key: "requests", label: "Enrolment requests", href: "/manager/assign?tab=requests", count: requests.length }, { key: "open", label: "My open assignments", href: "/manager/assign?tab=open", count: mine.length }]} />
      {tab === "assign" && (
        <Panel>
          <ActionForm action={assignAction} className="grid gap-5 lg:grid-cols-2">
            <Field label="Learning" htmlFor="item" required>
              <select id="item" name="item" required className="input-base">
                <optgroup label="Courses">{courses.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.code} — {c.title}</option>)}</optgroup>
                <optgroup label="Learning paths">{paths.map((p) => <option key={p.id} value={`path:${p.id}`}>{p.title}</option>)}</optgroup>
              </select>
            </Field>
            <Field label="Assignment type" htmlFor="kind"><select id="kind" name="kind" className="input-base"><option value="REQUIRED">Required — enrols the learner</option><option value="RECOMMENDED">Recommended — suggestion only</option></select></Field>
            <Field label="Audience" htmlFor="target"><select id="target" name="target" className="input-base"><option value="USERS">Selected employees</option>{isAdmin && <><option value="DEPARTMENT">Whole department</option><option value="JOB_ROLE">Everyone in a job role</option><option value="ALL">All active employees</option></>}</select></Field>
            <Field label="Due date" htmlFor="dueDate"><input id="dueDate" name="dueDate" type="date" className="input-base" /></Field>
            <div className="lg:col-span-2">
              <fieldset>
                <legend className="font-sans text-[0.8125rem] font-medium">Employees (when “Selected employees”)</legend>
                <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto rounded border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {people.filter((p) => p.id !== actor.id).map((p) => <label key={p.id} className="flex items-center gap-2 text-[0.875rem]"><input type="checkbox" name="userIds" value={p.id} className="h-4 w-4 accent-[rgb(22,38,68)]" />{p.name}<span className="type-meta">{p.profile?.jobRole?.title}</span></label>)}
                </div>
              </fieldset>
            </div>
            {isAdmin && (
              <>
                <Field label="Department (when “Whole department”)" htmlFor="departmentId"><select id="departmentId" name="departmentId" className="input-base"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                <Field label="Job role (when “Everyone in a job role”)" htmlFor="jobRoleId"><select id="jobRoleId" name="jobRoleId" className="input-base"><option value="">—</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
                <label className="flex items-center gap-2 font-sans text-sm lg:col-span-2"><input type="checkbox" name="isMandatory" className="h-4 w-4 accent-[rgb(22,38,68)]" />Mandatory training (requires a due date; tracked in compliance reporting)</label>
              </>
            )}
            <div className="lg:col-span-2"><Field label="Reason shown to the employee" htmlFor="reason"><textarea id="reason" name="reason" rows={2} className="input-base" /></Field></div>
            <div><SubmitButton>Create assignments</SubmitButton></div>
          </ActionForm>
        </Panel>
      )}
      {tab === "requests" && (requests.length === 0 ? <EmptyState title="No enrolment requests" /> : (
        <Panel bodyClassName="pt-0">
          <Table caption="Enrolment requests"><thead><tr><Th>Employee</Th><Th>Course</Th><Th>Requested</Th><Th>Decision</Th></tr></thead>
            <tbody>{requests.map((r) => <tr key={r.id}><Td className="font-medium">{r.user.name}</Td><Td>{r.course.code} — {r.course.title}</Td><Td>{fmtDate(r.enrolledAt)}</Td><Td><ActionForm action={enrolmentDecisionAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="enrollmentId" value={r.id} /><label htmlFor={`n-${r.id}`} className="sr-only">Note</label><input id={`n-${r.id}`} name="note" placeholder="Note (optional)" className="input-base h-8 w-44" /><SubmitButton size="sm" name="decision" value="approve">Approve</SubmitButton><SubmitButton size="sm" variant="secondary" name="decision" value="decline">Decline</SubmitButton></ActionForm></Td></tr>)}</tbody>
          </Table>
        </Panel>
      ))}
      {tab === "open" && (mine.length === 0 ? <EmptyState title="No open assignments created by you" /> : (
        <Panel bodyClassName="pt-0">
          <Table caption="Open assignments"><thead><tr><Th>Employee</Th><Th>Learning</Th><Th>Type</Th><Th>Due</Th><Th /></tr></thead>
            <tbody>{mine.map((a) => <tr key={a.id}><Td>{a.user.name}</Td><Td>{a.course?.title ?? a.path?.title}</Td><Td>{a.isMandatory ? <Status tone="crit">Mandatory</Status> : a.kind === "REQUIRED" ? "Required" : "Recommended"}</Td><Td>{fmtDate(a.dueDate)}</Td><Td align="right"><ActionForm action={cancelAssignmentAction} inline><input type="hidden" name="assignmentId" value={a.id} /><SubmitButton size="sm" variant="ghost" confirm="Cancel this assignment?">Cancel</SubmitButton></ActionForm></Td></tr>)}</tbody>
          </Table>
        </Panel>
      ))}
    </div>
  );
}
