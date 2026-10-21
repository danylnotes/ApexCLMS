import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { competencyProfileFor, METHOD_LABEL } from "@/server/services/competency";
import { CompetencyTable } from "@/components/competency-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, LinkButton, Metric, MetricRow, Notice, PageHeader, Panel, Status, TabNav } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requestCompetencyReviewAction } from "../learner-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Competency Profile") };
}

export default async function CompetencyPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const { view = "current" } = await searchParams;
  const { profile, current, target, additionalComps } = await competencyProfileFor(actor, actor.id);
  const [requests, framework] = await Promise.all([
    prisma.competencyReviewRequest.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 10, include: { competency: true, reviewer: { select: { name: true } } } }),
    prisma.competencyFramework.findFirst({ where: { status: "ACTIVE" }, include: { levels: { orderBy: { level: "asc" } } } }),
  ]);
  const data = view === "target" && target ? target : current;
  const s = data.summary;
  const options = [...current.rows, ...(target?.rows ?? [])].filter((r, i, a) => a.findIndex((x) => x.competency.id === r.competency.id) === i);
  return (
    <div>
      <PageHeader
        eyebrow={t("Development")}
        title={t("Competency Profile")}
        description={t("Your documented competence against the requirements of your role. Knowledge gained through courses is shown separately from competence demonstrated in the workplace.")}
        actions={<LinkButton href="/api/v1/exports/competency" variant="secondary">{t("Download record (CSV)")}</LinkButton>}
      />
      <TabNav current={view} tabs={[{ key: "current", label: profile?.jobRole ? t("Current role: {role}", { role: profile.jobRole.title }) : t("Current role"), href: "/competencies" }, ...(target ? [{ key: "target", label: t("Target role: {role}", { role: String(profile?.targetJobRole?.title) }), href: "/competencies?view=target" }] : [])]} />
      {data.rows.length === 0 ? (
        <EmptyState title={t("No competency requirements configured")}>{profile?.jobRole ? t("No requirements are defined for {role}.", { role: profile.jobRole.title }) : t("No job role is assigned to your profile.")} {t("Contact L&D.")}</EmptyState>
      ) : (
        <>
          <MetricRow cols={5}>
            <Metric label={t("Requirements met")} value={`${s.met}/${s.required}`} context={`${s.coveragePercent}%`} definition={t("Requirements where a current, unexpired assessment at or above the required level exists, with demonstrated evidence (or knowledge evidence where the framework allows).")} />
            <Metric label={t("Development gaps")} value={s.gaps} context={t("below required level")} />
            <Metric label={t("Significant gaps")} value={s.significantGaps} context={t("2+ levels")} tone={s.significantGaps ? "warn" : undefined} />
            <Metric label={t("Not yet assessed")} value={s.notAssessed} />
            <Metric label={t("Reassessment due")} value={s.expired} tone={s.expired ? "crit" : undefined} />
          </MetricRow>
          <Panel className="mt-8" title={view === "target" ? t("Readiness for target role") : t("Requirements of your current role")} description={t("Gaps indicate development opportunities, not performance judgements.")} bodyClassName="pt-0">
            <CompetencyTable rows={data.rows} />
          </Panel>
        </>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel title={t("Request a competency assessment")} description={t("Submit workplace evidence for review by your line manager or an authorised assessor.")}>
          {options.length === 0 ? <p className="type-meta">{t("No competencies available.")}</p> : (
            <ActionForm action={requestCompetencyReviewAction} className="space-y-4" resetOnSuccess>
              <Field label={t("Competency")} htmlFor="competencyId" required>
                <select id="competencyId" name="competencyId" className="input-base" required>{options.map((r) => <option key={r.competency.id} value={r.competency.id}>{r.competency.code} — {r.competency.name}</option>)}</select>
              </Field>
              <Field label={t("Level you believe you demonstrate")} htmlFor="requestedLevel" required>
                <select id="requestedLevel" name="requestedLevel" className="input-base">{framework?.levels.map((l) => <option key={l.level} value={l.level}>{l.level} — {l.name}</option>)}</select>
              </Field>
              <Field label={t("Evidence statement")} htmlFor="statement" hint={t("Describe specific situations where you performed this competency, with dates and outcomes.")} required>
                <textarea id="statement" name="statement" rows={4} minLength={30} required className="input-base" />
              </Field>
              <Field label={t("Supporting file (optional)")} htmlFor="file"><input id="file" name="file" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" className="block font-sans text-sm" /></Field>
              <SubmitButton>{t("Send request")}</SubmitButton>
            </ActionForm>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title={t("Your review requests")}>
            {requests.length === 0 ? <p className="type-meta">{t("No requests submitted.")}</p> : (
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="py-2.5 text-[0.875rem] first:pt-0">
                    <div className="flex justify-between gap-2"><span className="font-medium">{t("{competency} · level {level}", { competency: r.competency.name, level: r.requestedLevel })}</span><Status tone={r.status === "PENDING" ? "warn" : r.status === "ASSESSED" ? "ok" : "idle"}>{r.status === "PENDING" ? t("Pending") : r.status === "ASSESSED" ? t("Assessed") : t("Not assessed")}</Status></div>
                    <p className="type-meta">{r.reviewer ? t("Submitted {date} · reviewed by {name}", { date: fmtDate(r.createdAt), name: r.reviewer.name }) : t("Submitted {date}", { date: fmtDate(r.createdAt) })}</p>
                    {r.reviewNote && <p className="mt-1 text-ink-muted">{r.reviewNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {current.additional.length > 0 && (
            <Panel title={t("Other assessed competencies")} description={t("Recorded but not required by your current role.")}>
              <ul className="space-y-1.5 text-[0.875rem]">
                {current.additional.map((a) => { const c = additionalComps.find((x) => x.id === a.competencyId); return <li key={a.id} className="flex justify-between gap-2"><span>{c?.name}</span><span className="type-meta">{t("Level {level} · {method}", { level: a.level, method: METHOD_LABEL[a.method] })}</span></li>; })}
              </ul>
            </Panel>
          )}
          {framework && (
            <Panel title={t("Proficiency levels")}>
              <dl className="space-y-1.5 text-[0.8125rem]">{framework.levels.map((l) => <div key={l.level} className="grid grid-cols-[110px_1fr] gap-2"><dt className="font-medium">{l.level} · {l.name}</dt><dd className="text-ink-muted">{l.description}</dd></div>)}</dl>
              {!framework.allowCourseCompletionAsCompetence && <div className="mt-3"><Notice tone="info">{t("Under {framework}, course completion is recorded as knowledge evidence only. Workplace demonstration is required to meet a requirement.", { framework: framework.name })}</Notice></div>}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
