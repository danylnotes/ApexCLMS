import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getClaim, CPD_TYPE_LABEL } from "@/server/services/cpd";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KeyValue, Notice, PageHeader, Panel, Status } from "@/components/ui";
import { CPD_STATUS } from "@/lib/status";
import { fmtDate, fmtNum, sentence } from "@/lib/format";
import { claimOwnerAction } from "../../learner-actions";

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
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
  const unit = c.unit === "POINTS" ? "points" : "hours";
  const [label, tone] = CPD_STATUS[c.status];
  const ownerBtn = (to: string, text: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <ActionForm action={claimOwnerAction} inline><input type="hidden" name="claimId" value={c.id} /><input type="hidden" name="to" value={to} /><SubmitButton variant={variant} confirm={confirm}>{text}</SubmitButton></ActionForm>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader
        crumbs={[{ label: own ? "My CPD" : "CPD review", href: own ? "/cpd" : "/admin/cpd" }, { label: c.activity.title }]}
        eyebrow={`CPD claim · ${CPD_TYPE_LABEL[c.activity.type]}`}
        title={c.activity.title}
        meta={<><Status tone={tone}>{label}</Status>{!own && <span>{c.user.name}</span>}<span>{c.period?.name ?? "No period"}</span></>}
        actions={own ? (
          <>
            {c.status === "DRAFT" && ownerBtn("SUBMITTED", "Submit for review", "primary")}
            {c.status === "DRAFT" && !c.activity.courseCompletionId && !c.activity.webinarAttendanceId && ownerBtn("DELETE", "Delete draft", "danger", "Delete this draft claim?")}
            {c.status === "SUBMITTED" && ownerBtn("DRAFT", "Withdraw to draft")}
            {c.status === "REJECTED" && ownerBtn("DRAFT", "Revise and resubmit")}
          </>
        ) : null}
      />
      {created && <div className="mb-6"><Notice tone="ok">{c.status === "DRAFT" ? "Draft saved. Submit it when your evidence is complete." : "Claim submitted for review."}</Notice></div>}
      {c.status === "REJECTED" && <div className="mb-6"><Notice tone="crit" title="Reason for rejection">{c.rejectionReason}</Notice></div>}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Activity">
          <KeyValue cols={1} items={[["Provider", c.activity.provider], ["Date", fmtDate(c.activity.activityDate)], ["Duration", `${fmtNum(c.activity.durationHours.toString())} hours`], ["Related competency", c.activity.competency?.name], ["Description", c.activity.description], ["Learning outcomes", c.activity.learningOutcomes]]} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Claim">
            <KeyValue cols={1} items={[["Claimed", `${fmtNum(c.claimedValue.toString())} ${unit}`], ["Approved", c.approvedValue != null ? `${fmtNum(c.approvedValue.toString())} ${unit}` : "—"], ["Recognition", c.recognition === "PROFESSIONAL_BODY" ? "Intended for professional-body CPD" : "Company-recorded learning"], ["Source", c.activity.courseCompletionId ? "Platform-verified course completion" : c.activity.webinarAttendanceId ? "Verified webinar attendance" : "Submitted by employee"]]} />
          </Panel>
          <Panel title="Supporting evidence">
            {c.evidence.length === 0 ? <p className="type-meta">No evidence attached.</p> : (
              <ul className="space-y-2 text-[0.875rem]">{c.evidence.map((e) => <li key={e.id}>{e.description}{e.reference && <span className="type-meta"> · ref {e.reference}</span>}{e.file && <> · <a href={`/api/v1/files/${e.file.id}`}>{e.file.originalName}</a></>}</li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
      <Panel title="Approval history" className="mt-6" description="Every status change is recorded and cannot be edited.">
        <ol className="space-y-3">
          {c.approvals.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 text-[0.875rem]">
              <span className="w-28 shrink-0 font-sans text-[0.8125rem] text-ink-faint">{fmtDate(a.createdAt)}</span>
              <span><b className="font-medium">{sentence(a.fromStatus)} → {sentence(a.toStatus)}</b> by {a.actor.name}{a.value != null && ` · ${fmtNum(a.value.toString())} ${unit}`}{a.comment && <span className="block text-ink-muted">{a.comment}</span>}</span>
            </li>
          ))}
          {c.approvals.length === 0 && <li className="type-meta">Not yet submitted.</li>}
        </ol>
      </Panel>
    </div>
  );
}
