import Link from "next/link";
import type { PlanDetail } from "@/server/services/plans";
import { availablePlanTransitions, ownerCanEdit, PLAN_FLOW, PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { PLAN_TONE } from "@/lib/status";
import { fmtDate, sentence } from "@/lib/format";
import { ActionForm, SubmitButton } from "./forms";
import { Field, KeyValue, Panel, Status } from "./ui";
import { addPlanActionAction, deleteObjectiveAction, managerFeedbackAction, planCommentAction, planTransitionAction, saveObjectiveAction, togglePlanActionAction } from "@/app/(app)/learner-actions";

const MODEL: Record<string, string> = { EXPERIENTIAL: "Experiential (on the job)", SOCIAL: "Learning from others", FORMAL: "Formal learning" };

function ObjectiveFields({ o, competencies, readonlyCore }: { o?: PlanDetail["objectives"][number]; competencies: { id: string; code: string; name: string }[]; readonlyCore?: boolean }) {
  const d = (x?: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
  const id = (k: string) => `${k}-${o?.id ?? "new"}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Development goal" htmlFor={id("goal")} required><input id={id("goal")} name="goal" defaultValue={o?.goal} required readOnly={readonlyCore} className="input-base" /></Field></div>
      {!readonlyCore && (
        <>
          <Field label="Current capability" htmlFor={id("cc")}><textarea id={id("cc")} name="currentCapability" rows={2} defaultValue={o?.currentCapability ?? ""} className="input-base" /></Field>
          <Field label="Target capability" htmlFor={id("tc")}><textarea id={id("tc")} name="targetCapability" rows={2} defaultValue={o?.targetCapability ?? ""} className="input-base" /></Field>
          <Field label="Related competency" htmlFor={id("comp")}><select id={id("comp")} name="competencyId" defaultValue={o?.competencyId ?? ""} className="input-base"><option value="">None</option>{competencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></Field>
          <Field label="Competency gap" htmlFor={id("gap")}><input id={id("gap")} name="competencyGap" defaultValue={o?.competencyGap ?? ""} className="input-base" /></Field>
          <Field label="Workplace application" htmlFor={id("wa")}><textarea id={id("wa")} name="workplaceApplication" rows={2} defaultValue={o?.workplaceApplication ?? ""} className="input-base" /></Field>
          <Field label="Planning model (optional 70-20-10)" htmlFor={id("lm")} hint="An optional planning aid, not a fixed rule."><select id={id("lm")} name="learningModel" defaultValue={o?.learningModel ?? ""} className="input-base"><option value="">Not specified</option>{Object.entries(MODEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Responsible person" htmlFor={id("resp")}><input id={id("resp")} name="responsible" defaultValue={o?.responsible ?? ""} className="input-base" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target date" htmlFor={id("td")}><input id={id("td")} name="targetDate" type="date" defaultValue={d(o?.targetDate)} className="input-base" /></Field>
            <Field label="Review date" htmlFor={id("rd")}><input id={id("rd")} name="reviewDate" type="date" defaultValue={d(o?.reviewDate)} className="input-base" /></Field>
          </div>
        </>
      )}
      <Field label="Supporting evidence" htmlFor={id("ev")}><textarea id={id("ev")} name="supportingEvidence" rows={2} defaultValue={o?.supportingEvidence ?? ""} className="input-base" /></Field>
      {o && (
        <Field label="Status" htmlFor={id("st")}><select id={id("st")} name="status" defaultValue={o.status} className="input-base">{["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DEFERRED"].map((s) => <option key={s} value={s}>{sentence(s)}</option>)}</select></Field>
      )}
    </div>
  );
}

export function PlanView({ plan, role, competencies, courses }: { plan: PlanDetail; role: "OWNER" | "REVIEWER" | "VIEWER"; competencies: { id: string; code: string; name: string }[]; courses: { id: string; code: string; title: string }[] }) {
  const transitions = role === "VIEWER" ? [] : availablePlanTransitions(plan.status, role);
  const editable = role === "OWNER" && ownerCanEdit(plan.status);
  const progressOnly = role === "OWNER" && plan.status === "IN_PROGRESS";
  const stepIdx = PLAN_FLOW.indexOf(plan.status);
  const now = new Date();
  return (
    <div className="space-y-8">
      <ol aria-label="Plan workflow" className="flex flex-wrap items-center gap-y-2 font-sans text-[0.75rem]">
        {PLAN_FLOW.map((s, i) => (
          <li key={s} className="flex items-center">
            <span className={`rounded-[3px] px-2 py-1 ${i === stepIdx ? "bg-navy font-semibold text-white" : i < stepIdx ? "bg-navy-50 text-navy" : "text-ink-faint ring-1 ring-inset ring-line"}`} aria-current={i === stepIdx ? "step" : undefined}>{PLAN_STATUS_LABEL[s]}</span>
            {i < PLAN_FLOW.length - 1 && <span aria-hidden className="mx-1.5 text-ink-faint">→</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Plan summary">
          <KeyValue items={[["Employee", plan.user.name], ["Reviewer", plan.reviewer?.name ?? "No line manager assigned"], ["Current role", plan.user.profile?.jobRole?.title], ["Target role", plan.targetJobRole?.title ?? "—"], ["Period", plan.period?.name], ["Version", `v${plan.version}${plan.agreedAt ? ` · agreed ${fmtDate(plan.agreedAt)}` : ""}`]]} />
          {plan.careerAspiration && <><p className="mt-4 type-eyebrow">Career aspiration</p><p className="mt-1 text-[0.9375rem]">{plan.careerAspiration}</p></>}
        </Panel>
        {transitions.length > 0 && (
          <Panel title={role === "REVIEWER" ? "Manager review" : "Next step"}>
            <div className="space-y-3">
              {transitions.map((t) => (
                <ActionForm key={t.to} action={planTransitionAction} className="space-y-2">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="to" value={t.to} />
                  {(t.requiresComment || role === "REVIEWER") && (
                    <Field label={t.requiresComment ? "Comment (required)" : "Comment (optional)"} htmlFor={`c-${t.to}`}><textarea id={`c-${t.to}`} name="comment" rows={2} required={t.requiresComment} className="input-base" /></Field>
                  )}
                  <SubmitButton variant={t.to === "DRAFT" ? "secondary" : "primary"} size="sm">{t.label}</SubmitButton>
                </ActionForm>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <section aria-labelledby="obj-h">
        <h2 id="obj-h" className="type-title mb-3">Development objectives</h2>
        <div className="space-y-4">
          {plan.objectives.length === 0 && <p className="type-meta">No objectives yet.</p>}
          {plan.objectives.map((o, i) => {
            const overdue = o.targetDate && o.targetDate < now && !["COMPLETED", "DEFERRED"].includes(o.status);
            return (
              <article key={o.id} className="rounded-md border border-line bg-surface">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3">
                  <div>
                    <p className="type-eyebrow">Objective {i + 1}{o.learningModel ? ` · ${MODEL[o.learningModel]}` : ""}</p>
                    <h3 className="font-sans text-[0.9375rem] font-semibold">{o.goal}</h3>
                  </div>
                  <div className="flex gap-1.5">{overdue && <Status tone="crit">Past target date</Status>}<Status tone={o.status === "COMPLETED" ? "ok" : o.status === "IN_PROGRESS" ? "info" : "idle"}>{sentence(o.status)}</Status></div>
                </header>
                <div className="px-5 py-4">
                  <KeyValue cols={3} items={[["Current capability", o.currentCapability], ["Target capability", o.targetCapability], ["Competency", o.competency?.name], ["Competency gap", o.competencyGap], ["Workplace application", o.workplaceApplication], ["Supporting evidence", o.supportingEvidence], ["Responsible", o.responsible], ["Target date", fmtDate(o.targetDate)], ["Review date", fmtDate(o.reviewDate)]]} />
                  {o.actions.length > 0 && (
                    <div className="mt-4">
                      <p className="type-eyebrow mb-1">Planned learning activities</p>
                      <ul className="space-y-1 text-[0.875rem]">
                        {o.actions.map((a) => (
                          <li key={a.id} className="flex items-center gap-2">
                            {role === "OWNER" && plan.status !== "COMPLETED" ? (
                              <ActionForm action={togglePlanActionAction} inline><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="actionId" value={a.id} /><button type="submit" aria-label={a.completedAt ? "Mark not done" : "Mark done"} className={`h-4 w-4 rounded-[3px] border ${a.completedAt ? "border-ok bg-ok" : "border-line-strong"}`} /></ActionForm>
                            ) : <span aria-hidden>{a.completedAt ? "✓" : "○"}</span>}
                            <span className={a.completedAt ? "text-ink-muted line-through" : ""}>{a.course ? <Link href={`/courses/${a.course.slug}`}>{a.title}</Link> : a.title}</span>
                            <span className="type-meta">{sentence(a.type)}{a.dueDate ? ` · ${fmtDate(a.dueDate)}` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {o.managerFeedback && <p className="mt-4 rounded bg-canvas px-3 py-2 text-[0.875rem]"><b className="font-sans text-[0.8125rem]">Manager feedback:</b> {o.managerFeedback}</p>}
                  {role === "REVIEWER" && plan.status !== "COMPLETED" && (
                    <ActionForm action={managerFeedbackAction} className="mt-4 space-y-2">
                      <input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="objectiveId" value={o.id} />
                      <Field label="Manager feedback" htmlFor={`fb-${o.id}`}><textarea id={`fb-${o.id}`} name="feedback" rows={2} defaultValue={o.managerFeedback ?? ""} className="input-base" /></Field>
                      <SubmitButton size="sm" variant="secondary">Save feedback</SubmitButton>
                    </ActionForm>
                  )}
                  {(editable || progressOnly) && (
                    <details className="mt-4 border-t border-line pt-3 no-print">
                      <summary className="cursor-pointer font-sans text-sm font-medium text-navy-700">{progressOnly ? "Update progress" : "Edit objective"}</summary>
                      <ActionForm action={saveObjectiveAction} className="mt-3 space-y-3">
                        <input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="objectiveId" value={o.id} />
                        <ObjectiveFields o={o} competencies={competencies} readonlyCore={progressOnly} />
                        <SubmitButton size="sm">Save</SubmitButton>
                      </ActionForm>
                      {editable && (
                        <ActionForm action={deleteObjectiveAction} inline className="mt-2"><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="objectiveId" value={o.id} /><SubmitButton size="sm" variant="danger" confirm="Remove this objective?">Remove objective</SubmitButton></ActionForm>
                      )}
                      <ActionForm action={addPlanActionAction} className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-4" resetOnSuccess>
                        <input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="objectiveId" value={o.id} />
                        <div className="sm:col-span-2"><Field label="Add learning activity" htmlFor={`at-${o.id}`}><input id={`at-${o.id}`} name="title" required className="input-base" /></Field></div>
                        <Field label="Type" htmlFor={`aty-${o.id}`}><select id={`aty-${o.id}`} name="type" className="input-base">{["COURSE", "ON_THE_JOB", "MENTORING", "PROJECT", "WEBINAR", "OTHER"].map((t) => <option key={t} value={t}>{sentence(t)}</option>)}</select></Field>
                        <Field label="Course (optional)" htmlFor={`ac-${o.id}`}><select id={`ac-${o.id}`} name="courseId" className="input-base"><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select></Field>
                        <div className="sm:col-span-4"><SubmitButton size="sm" variant="secondary">Add activity</SubmitButton></div>
                      </ActionForm>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {editable && (
          <details className="mt-4 rounded-md border border-dashed border-line-strong bg-surface p-5 no-print" open={plan.objectives.length === 0}>
            <summary className="cursor-pointer font-sans text-sm font-semibold text-navy">Add an objective</summary>
            <ActionForm action={saveObjectiveAction} className="mt-4 space-y-3" resetOnSuccess>
              <input type="hidden" name="planId" value={plan.id} />
              <ObjectiveFields competencies={competencies} />
              <SubmitButton size="sm">Add objective</SubmitButton>
            </ActionForm>
          </details>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Comments">
          <ul className="space-y-3">
            {plan.comments.map((c) => <li key={c.id} className="text-[0.875rem]"><p className="type-meta">{c.author.name} · {fmtDate(c.createdAt)}</p><p>{c.body}</p></li>)}
            {plan.comments.length === 0 && <li className="type-meta">No comments yet.</li>}
          </ul>
          {role !== "VIEWER" && (
            <ActionForm action={planCommentAction} className="mt-4 space-y-2 no-print" resetOnSuccess>
              <input type="hidden" name="planId" value={plan.id} />
              <label htmlFor="comment-body" className="sr-only">Add a comment</label>
              <textarea id="comment-body" name="body" rows={2} required className="input-base" placeholder="Add a comment" />
              <SubmitButton size="sm" variant="secondary">Post comment</SubmitButton>
            </ActionForm>
          )}
        </Panel>
        <Panel title="Revision history" description="Each workflow step is recorded with a snapshot of the plan.">
          <ol className="space-y-2.5">
            {plan.reviews.map((r) => <li key={r.id} className="text-[0.875rem]"><p className="type-meta">{fmtDate(r.createdAt)} · v{r.version} · {r.actor.name}</p><p><Status tone={PLAN_TONE[r.toStatus]} glyph={false}>{r.decision}</Status></p>{r.comments && <p className="mt-0.5 text-ink-muted">{r.comments}</p>}</li>)}
            {plan.reviews.length === 0 && <li className="type-meta">No workflow steps yet.</li>}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
