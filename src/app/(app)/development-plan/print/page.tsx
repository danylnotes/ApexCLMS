import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getPlan } from "@/server/services/plans";
import { getSettings } from "@/server/settings";
import { OBJECTIVE_STATUS_LABEL, PLAN_STATUS_LABEL } from "@/lib/domain/plan";
import { fmtDate, sentence } from "@/lib/format";
import { PrintButton } from "./print-button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Development plan (print)") };
}

export default async function PrintPlan({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { t } = await getI18n();
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
        <p className="type-eyebrow">{t("{organisation} · Individual Development Plan · Confidential", { organisation: branding.organisationName })}</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-navy">{plan.title}</h1>
        <p className="mt-1 font-sans text-sm text-ink-muted">{plan.user.name} · {plan.user.profile?.jobRole?.title} · {plan.user.profile?.department?.name} · {t("Reviewer: {name}", { name: plan.reviewer?.name ?? "—" })} · {t("Status: {status}", { status: PLAN_STATUS_LABEL[plan.status] })} · v{plan.version}</p>
      </header>
      {plan.careerAspiration && <section className="mt-5"><h2 className="font-sans text-sm font-semibold">{t("Career aspiration")}</h2><p className="mt-1">{plan.careerAspiration}</p><p className="mt-1 text-sm text-ink-muted">{t("Target role: {role}", { role: plan.targetJobRole?.title ?? "—" })}</p></section>}
      {plan.objectives.map((o, i) => (
        <section key={o.id} className="mt-6 break-inside-avoid border-t border-line pt-4">
          <h2 className="font-sans text-[0.9375rem] font-semibold">{i + 1}. {o.goal}</h2>
          <table className="mt-2 w-full text-[0.8125rem]"><tbody>
            {[[t("Current capability"), o.currentCapability], [t("Target capability"), o.targetCapability], [t("Competency"), o.competency?.name], [t("Gap"), o.competencyGap], [t("Planned activities"), o.actions.map((a) => a.title).join("; ")], [t("Workplace application"), o.workplaceApplication], [t("Evidence"), o.supportingEvidence], [t("Responsible"), o.responsible], [t("Target / review date"), `${fmtDate(o.targetDate)} / ${fmtDate(o.reviewDate)}`], [t("Status"), o.status in OBJECTIVE_STATUS_LABEL ? OBJECTIVE_STATUS_LABEL[o.status] : sentence(o.status)], [t("Manager feedback"), o.managerFeedback]].map(([k, v]) => (
              <tr key={k as string} className="border-b border-line align-top"><th className="w-44 py-1 pe-3 text-start font-sans font-medium text-ink-muted">{k}</th><td className="py-1">{v || "—"}</td></tr>
            ))}
          </tbody></table>
        </section>
      ))}
      <footer className="mt-10 grid grid-cols-2 gap-10 text-sm">
        <div className="border-t border-ink pt-2">{t("Employee signature / date")}</div>
        <div className="border-t border-ink pt-2">{t("Manager signature / date")}</div>
      </footer>
      <p className="mt-6 font-sans text-[0.75rem] text-ink-faint">{t("Generated {date} from {product}.", { date: fmtDate(new Date()), product: branding.productName })} {plan.agreedAt ? t("Agreed {date}.", { date: fmtDate(plan.agreedAt) }) : t("Not yet agreed.")}</p>
    </article>
  );
}
