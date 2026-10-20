import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { contentAccess, courseAudienceWhere } from "@/server/services/access";
import { plansFor } from "@/server/services/plans";
import { PlanView } from "@/components/plan-view";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, LinkButton, PageHeader, Panel, Status } from "@/components/ui";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { PLAN_TONE } from "@/lib/status";
import { createPlanAction } from "../learner-actions";

export const metadata = { title: "Individual Development Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const actor = await requireActor();
  const { id } = await searchParams;
  const [plans, competencies, courses, roles, profile] = await Promise.all([
    plansFor(actor, actor.id),
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.course.findMany({ where: { status: "PUBLISHED", ...courseAudienceWhere(await contentAccess(actor.id)) }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    prisma.jobRole.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
    prisma.userProfile.findUnique({ where: { userId: actor.id } }),
  ]);
  const plan = plans.find((p) => p.id === id) ?? plans[0];
  const open = plans.some((p) => p.status !== "COMPLETED");
  return (
    <div>
      <PageHeader
        eyebrow="Development"
        title="Individual Development Plan"
        description="Agree development objectives with your manager and track them through to completion."
        actions={plan ? <LinkButton href={`/development-plan/print?id=${plan.id}`} variant="secondary">Printable plan</LinkButton> : null}
        meta={plan ? <><span>{plan.title}</span><Status tone={PLAN_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Status></> : undefined}
      />
      {plans.length > 1 && (
        <nav aria-label="Plans" className="mb-6 flex flex-wrap gap-2 font-sans text-[0.8125rem]">
          {plans.map((p) => <a key={p.id} href={`/development-plan?id=${p.id}`} className={`rounded px-2 py-1 no-underline ${p.id === plan?.id ? "bg-navy-50 text-navy" : "text-ink-muted"}`}>{p.title}</a>)}
        </nav>
      )}
      {!open && (
        <Panel title={plans.length ? "Start a new development plan" : "Create your development plan"} className="mb-8" description="Your plan is visible to you and your line manager. It is reviewed through: Draft → Employee Review → Manager Review → Agreed → In Progress → Completed.">
          <ActionForm action={createPlanAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan title" htmlFor="title" required><input id="title" name="title" required defaultValue={`${new Date().getFullYear()} Development Plan`} className="input-base" /></Field>
            <Field label="Target role" htmlFor="targetJobRoleId"><select id="targetJobRoleId" name="targetJobRoleId" defaultValue={profile?.targetJobRoleId ?? ""} className="input-base"><option value="">Not set</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Career aspiration" htmlFor="careerAspiration"><textarea id="careerAspiration" name="careerAspiration" rows={2} className="input-base" /></Field></div>
            <div><SubmitButton>Create plan</SubmitButton></div>
          </ActionForm>
        </Panel>
      )}
      {plan && <PlanView plan={plan} role="OWNER" competencies={competencies} courses={courses} />}
    </div>
  );
}
