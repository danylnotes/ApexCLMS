import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getPlan } from "@/server/services/plans";
import { getSettings } from "@/server/settings";
import { PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { fmtDate, sentence } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = { title: "Development plan (print)" };

export default async function PrintPlan({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const actor = await requireActor();
  const { id } = await searchParams;
  if (!id) notFound();
  let res;
  try {
    res = await getPlan(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { plan } = res;
  const { branding } = await getSettings();
  return (
    <article className="mx-auto max-w-3xl bg-surface p-10 print:p-0">
      <div className="mb-6 flex justify-end no-print"><PrintButton /></div>
      <header className="border-b-2 border-navy pb-4">
        <p className="type-eyebrow">{branding.organisationName} · Individual Development Plan · Confidential</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-navy">{plan.title}</h1>
        <p className="mt-1 font-sans text-sm text-ink-muted">{plan.user.name} · {plan.user.profile?.jobRole?.title} · {plan.user.profile?.department?.name} · Reviewer: {plan.reviewer?.name ?? "—"} · Status: {PLAN_STATUS_LABEL[plan.status]} · v{plan.version}</p>
      </header>
      {plan.careerAspiration && <section className="mt-5"><h2 className="font-sans text-sm font-semibold">Career aspiration</h2><p className="mt-1">{plan.careerAspiration}</p><p className="mt-1 text-sm text-ink-muted">Target role: {plan.targetJobRole?.title ?? "—"}</p></section>}
      {plan.objectives.map((o, i) => (
        <section key={o.id} className="mt-6 break-inside-avoid border-t border-line pt-4">
          <h2 className="font-sans text-[0.9375rem] font-semibold">{i + 1}. {o.goal}</h2>
          <table className="mt-2 w-full text-[0.8125rem]"><tbody>
            {[["Current capability", o.currentCapability], ["Target capability", o.targetCapability], ["Competency", o.competency?.name], ["Gap", o.competencyGap], ["Planned activities", o.actions.map((a) => a.title).join("; ")], ["Workplace application", o.workplaceApplication], ["Evidence", o.supportingEvidence], ["Responsible", o.responsible], ["Target / review date", `${fmtDate(o.targetDate)} / ${fmtDate(o.reviewDate)}`], ["Status", sentence(o.status)], ["Manager feedback", o.managerFeedback]].map(([k, v]) => (
              <tr key={k as string} className="border-b border-line align-top"><th className="w-44 py-1 pr-3 text-left font-sans font-medium text-ink-muted">{k}</th><td className="py-1">{v || "—"}</td></tr>
            ))}
          </tbody></table>
        </section>
      ))}
      <footer className="mt-10 grid grid-cols-2 gap-10 text-sm">
        <div className="border-t border-ink pt-2">Employee signature / date</div>
        <div className="border-t border-ink pt-2">Manager signature / date</div>
      </footer>
      <p className="mt-6 font-sans text-[0.75rem] text-ink-faint">Generated {fmtDate(new Date())} from {branding.productName}. {plan.agreedAt ? `Agreed ${fmtDate(plan.agreedAt)}.` : "Not yet agreed."}</p>
    </article>
  );
}
