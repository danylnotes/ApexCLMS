import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can } from "@/server/policy";
import { reviewQueue, CPD_TYPE_LABEL } from "@/server/services/cpd";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { CPD_STATUS } from "@/lib/status";
import { fmtDate, fmtNum } from "@/lib/format";
import { cpdDecisionAction, savePeriodAction, savePolicyAction } from "../../staff-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("CPD Administration") };
}

export default async function CpdAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePagePermission("cpd.approve", "cpd.configure");
  const { t } = await getI18n();
  const unitLabel = (u: string) => ({ HOURS: t("hours"), POINTS: t("points") })[u] ?? u.toLowerCase();
  const { tab = can(actor, "cpd.approve") ? "review" : "policies" } = await searchParams;
  const [queue, policies, periods] = await Promise.all([can(actor, "cpd.approve") ? reviewQueue(actor) : Promise.resolve([]), prisma.cpdPolicy.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { profiles: true } } } }), prisma.reportingPeriod.findMany({ orderBy: { startDate: "desc" } })]);
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("CPD Administration")} description={t("Review claims and configure CPD rules according to the relevant professional body or internal policy.")} />
      <TabNav current={tab} tabs={[...(can(actor, "cpd.approve") ? [{ key: "review", label: t("Review queue"), href: "/admin/cpd", count: queue.length }] : []), ...(can(actor, "cpd.configure") ? [{ key: "policies", label: t("Policies"), href: "/admin/cpd?tab=policies" }, { key: "periods", label: t("Reporting periods"), href: "/admin/cpd?tab=periods" }] : [])]} />
      {tab === "review" && (queue.length === 0 ? <EmptyState title={t("No claims awaiting review")} /> : (
        <div className="space-y-4">
          {queue.map((c) => (
            <Panel key={c.id} title={<Link href={`/cpd/${c.id}`}>{c.activity.title}</Link>} description={`${c.user.name} · ${c.user.profile?.department?.name ?? ""} · ${CPD_TYPE_LABEL[c.activity.type]} · ${fmtDate(c.activity.activityDate)} · ${t("{n} h", { n: fmtNum(c.activity.durationHours.toString()) })}`} actions={<Status tone={CPD_STATUS[c.status][1]}>{CPD_STATUS[c.status][0]}</Status>}>
              <p className="text-[0.875rem] text-ink-muted">{c.activity.description}</p>
              <p className="mt-1 text-[0.8125rem]">{t("Claimed")} <b>{fmtNum(c.claimedValue.toString())} {unitLabel(c.unit)}</b> · {c.recognition === "PROFESSIONAL_BODY" ? t("for professional-body recognition") : t("company-recorded")} · {t("evidence:")} {c.evidence.length ? c.evidence.map((e) => e.description).join("; ") : <span className="text-crit">{t("none attached")}</span>}</p>
              <ActionForm action={cpdDecisionAction} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                <input type="hidden" name="claimId" value={c.id} />
                <Field label={t("Approved value ({unit})", { unit: unitLabel(c.unit) })} htmlFor={`v-${c.id}`}><input id={`v-${c.id}`} name="approvedValue" type="number" step="0.25" min={0} max={Number(c.claimedValue)} defaultValue={Number(c.claimedValue)} className="input-base" /></Field>
                <Field label={t("Comment (required to reject)")} htmlFor={`m-${c.id}`}><input id={`m-${c.id}`} name="comment" className="input-base" /></Field>
                <div className="flex gap-2">{c.status === "SUBMITTED" && <SubmitButton size="sm" variant="ghost" name="decision" value="UNDER_REVIEW">{t("Start review")}</SubmitButton>}<SubmitButton size="sm" name="decision" value="APPROVED">{t("Approve")}</SubmitButton><SubmitButton size="sm" variant="danger" name="decision" value="REJECTED">{t("Reject")}</SubmitButton></div>
              </ActionForm>
            </Panel>
          ))}
        </div>
      ))}
      {tab === "policies" && (
        <div className="space-y-6">
          {[...policies, null].map((p) => (
            <Panel key={p?.id ?? "new"} title={p ? p.name : t("New CPD policy")} description={p ? `${t("{count, plural, one {# employee} other {# employees}}", { count: p._count.profiles })} · ${p.targetPerPeriod != null ? t("target {value} {unit} per period", { value: Number(p.targetPerPeriod), unit: unitLabel(p.unit) }) : t("record only — no target")}` : t("Targets are optional and never applied universally.")}>
              <ActionForm action={savePolicyAction} className="grid gap-3 md:grid-cols-4">
                {p && <input type="hidden" name="id" value={p.id} />}
                <div className="md:col-span-2"><Field label={t("Name")} htmlFor={`pn-${p?.id ?? "n"}`}><input id={`pn-${p?.id ?? "n"}`} name="name" defaultValue={p?.name} required className="input-base" /></Field></div>
                <div className="md:col-span-2"><Field label={t("Professional body")} htmlFor={`pb-${p?.id ?? "n"}`}><input id={`pb-${p?.id ?? "n"}`} name="professionalBody" defaultValue={p?.professionalBody ?? ""} className="input-base" /></Field></div>
                <Field label={t("Unit")} htmlFor={`pu-${p?.id ?? "n"}`}><select id={`pu-${p?.id ?? "n"}`} name="unit" defaultValue={p?.unit ?? "HOURS"} className="input-base"><option value="HOURS">{t("Hours")}</option><option value="POINTS">{t("Points")}</option></select></Field>
                <Field label={t("Target per period")} htmlFor={`pt-${p?.id ?? "n"}`} hint={t("Blank = no target")}><input id={`pt-${p?.id ?? "n"}`} name="targetPerPeriod" type="number" step="0.5" defaultValue={p?.targetPerPeriod != null ? Number(p.targetPerPeriod) : ""} className="input-base" /></Field>
                <Field label={t("Points per hour")} htmlFor={`pp-${p?.id ?? "n"}`}><input id={`pp-${p?.id ?? "n"}`} name="pointsPerHour" type="number" step="0.1" defaultValue={p?.pointsPerHour != null ? Number(p.pointsPerHour) : ""} className="input-base" /></Field>
                <Field label={t("Max per activity")} htmlFor={`pm-${p?.id ?? "n"}`}><input id={`pm-${p?.id ?? "n"}`} name="maxPerActivity" type="number" step="0.5" defaultValue={p?.maxPerActivity != null ? Number(p.maxPerActivity) : ""} className="input-base" /></Field>
                <div className="md:col-span-4"><Field label={t("Description")} htmlFor={`pd-${p?.id ?? "n"}`}><input id={`pd-${p?.id ?? "n"}`} name="description" defaultValue={p?.description ?? ""} className="input-base" /></Field></div>
                <fieldset className="md:col-span-4"><legend className="font-sans text-[0.8125rem] font-medium">{t("Eligible activity types (none selected = all)")}</legend><div className="mt-1 grid gap-1 sm:grid-cols-3">{Object.entries(CPD_TYPE_LABEL).map(([k, v]) => <label key={k} className="flex items-center gap-2 text-[0.8125rem]"><input type="checkbox" name="eligibleTypes" value={k} defaultChecked={p?.eligibleTypes.includes(k as never)} className="h-4 w-4 accent-[rgb(22,38,68)]" />{v}</label>)}</div></fieldset>
                <label className="flex items-center gap-2 text-[0.8125rem] md:col-span-3"><input type="checkbox" name="autoApprove" defaultChecked={p?.autoApproveVerifiedInternal} className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Auto-approve platform-verified internal learning (course completions and verified webinars)")}</label>
                <div><SubmitButton size="sm">{p ? t("Save policy") : t("Create policy")}</SubmitButton></div>
              </ActionForm>
            </Panel>
          ))}
        </div>
      )}
      {tab === "periods" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("Reporting periods")} bodyClassName="pt-0"><Table caption={t("Periods")}><thead><tr><Th>{t("Name")}</Th><Th>{t("Start")}</Th><Th>{t("End")}</Th><Th>{t("Current")}</Th></tr></thead><tbody>{periods.map((p) => <tr key={p.id}><Td>{p.name}</Td><Td>{fmtDate(p.startDate)}</Td><Td>{fmtDate(p.endDate)}</Td><Td>{p.isCurrent ? <Status tone="ok">{t("Current")}</Status> : ""}</Td></tr>)}</tbody></Table></Panel>
          <Panel title={t("Add or update a period")}>
            <ActionForm action={savePeriodAction} className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Name")} htmlFor="pname"><input id="pname" name="name" required className="input-base" placeholder={t("e.g. {example}", { example: "2027" })} /></Field><span />
              <Field label={t("Start")} htmlFor="ps"><input id="ps" name="startDate" type="date" required className="input-base" /></Field>
              <Field label={t("End")} htmlFor="pe"><input id="pe" name="endDate" type="date" required className="input-base" /></Field>
              <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="isCurrent" className="h-4 w-4 accent-[rgb(22,38,68)]" />{t("Make current")}</label>
              <div><SubmitButton size="sm">{t("Save period")}</SubmitButton></div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </div>
  );
}
