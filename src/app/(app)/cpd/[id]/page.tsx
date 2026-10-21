import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getClaim, CPD_TYPE_LABEL } from "@/server/services/cpd";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KeyValue, Notice, PageHeader, Panel, Status } from "@/components/ui";
import { CPD_STATUS } from "@/lib/status";
import { fmtDate, fmtNum, sentence } from "@/lib/format";
import { claimOwnerAction } from "../../learner-actions";
import { getI18n } from "@/i18n/server";

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const { id } = await params;
  const { created } = await searchParams;
  let c;
  try {
    c = await getClaim(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const own = c.userId === actor.id;
  const unit = c.unit === "POINTS" ? t("points") : t("hours");
  const statusLabel = (s: string) => (s in CPD_STATUS ? CPD_STATUS[s][0] : sentence(s));
  const [label, tone] = CPD_STATUS[c.status];
  const ownerBtn = (to: string, text: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <ActionForm action={claimOwnerAction} inline><input type="hidden" name="claimId" value={c.id} /><input type="hidden" name="to" value={to} /><SubmitButton variant={variant} confirm={confirm}>{text}</SubmitButton></ActionForm>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader
        crumbs={[{ label: own ? t("My CPD") : t("CPD review"), href: own ? "/cpd" : "/admin/cpd" }, { label: c.activity.title }]}
        eyebrow={t("CPD claim · {type}", { type: CPD_TYPE_LABEL[c.activity.type] })}
        title={c.activity.title}
        meta={<><Status tone={tone}>{label}</Status>{!own && <span>{c.user.name}</span>}<span>{c.period?.name ?? t("No period")}</span></>}
        actions={own ? (
          <>
            {c.status === "DRAFT" && ownerBtn("SUBMITTED", t("Submit for review"), "primary")}
            {c.status === "DRAFT" && !c.activity.courseCompletionId && !c.activity.webinarAttendanceId && ownerBtn("DELETE", t("Delete draft"), "danger", t("Delete this draft claim?"))}
            {c.status === "SUBMITTED" && ownerBtn("DRAFT", t("Withdraw to draft"))}
            {c.status === "REJECTED" && ownerBtn("DRAFT", t("Revise and resubmit"))}
          </>
        ) : null}
      />
      {created && <div className="mb-6"><Notice tone="ok">{c.status === "DRAFT" ? t("Draft saved. Submit it when your evidence is complete.") : t("Claim submitted for review.")}</Notice></div>}
      {c.status === "REJECTED" && <div className="mb-6"><Notice tone="crit" title={t("Reason for rejection")}>{c.rejectionReason}</Notice></div>}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title={t("Activity")}>
          <KeyValue cols={1} items={[[t("Provider"), c.activity.provider], [t("Date"), fmtDate(c.activity.activityDate)], [t("Duration"), t("{value} hours", { value: fmtNum(c.activity.durationHours.toString()) })], [t("Related competency"), c.activity.competency?.name], [t("Description"), c.activity.description], [t("Learning outcomes"), c.activity.learningOutcomes]]} />
        </Panel>
        <div className="space-y-6">
          <Panel title={t("Claim")}>
            <KeyValue cols={1} items={[[t("Claimed"), `${fmtNum(c.claimedValue.toString())} ${unit}`], [t("Approved"), c.approvedValue != null ? `${fmtNum(c.approvedValue.toString())} ${unit}` : "—"], [t("Recognition"), c.recognition === "PROFESSIONAL_BODY" ? t("Intended for professional-body CPD") : t("Company-recorded learning")], [t("Source"), c.activity.courseCompletionId ? t("Platform-verified course completion") : c.activity.webinarAttendanceId ? t("Verified webinar attendance") : t("Submitted by employee")]]} />
          </Panel>
          <Panel title={t("Supporting evidence")}>
            {c.evidence.length === 0 ? <p className="type-meta">{t("No evidence attached.")}</p> : (
              <ul className="space-y-2 text-[0.875rem]">{c.evidence.map((e) => <li key={e.id}>{e.description}{e.reference && <span className="type-meta"> · {t("ref {reference}", { reference: e.reference })}</span>}{e.file && <> · <a href={`/api/v1/files/${e.file.id}`}>{e.file.originalName}</a></>}</li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
      <Panel title={t("Approval history")} className="mt-6" description={t("Every status change is recorded and cannot be edited.")}>
        <ol className="space-y-3">
          {c.approvals.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 text-[0.875rem]">
              <span className="w-28 shrink-0 font-sans text-[0.8125rem] text-ink-faint">{fmtDate(a.createdAt)}</span>
              <span><b className="font-medium">{t("{from} → {to}", { from: statusLabel(a.fromStatus), to: statusLabel(a.toStatus) })}</b> {t("by {name}", { name: a.actor.name })}{a.value != null && ` · ${fmtNum(a.value.toString())} ${unit}`}{a.comment && <span className="block text-ink-muted">{a.comment}</span>}</span>
            </li>
          ))}
          {c.approvals.length === 0 && <li className="type-meta">{t("Not yet submitted.")}</li>}
        </ol>
      </Panel>
    </div>
  );
}
