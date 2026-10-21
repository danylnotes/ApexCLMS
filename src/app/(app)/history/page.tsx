import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Pagination, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate, sentence } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Learning History") };
}

const TYPES = ["COURSE_COMPLETED", "ASSESSMENT_PASSED", "ASSESSMENT_FAILED", "CERTIFICATE_ISSUED", "WEBINAR_ATTENDED", "CPD_APPROVED", "CPD_SUBMITTED", "CPD_REJECTED", "COMPETENCY_ASSESSED", "PLAN_REVIEWED", "ENROLLED", "LESSON_COMPLETED", "WEBINAR_REGISTERED", "PATH_STARTED"] as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const { t } = await getI18n();
  const LABEL: Record<string, string> = {
    COURSE_COMPLETED: t("Course completed"),
    ASSESSMENT_PASSED: t("Assessment passed"),
    ASSESSMENT_FAILED: t("Assessment failed"),
    CERTIFICATE_ISSUED: t("Certificate issued"),
    WEBINAR_ATTENDED: t("Webinar attended"),
    CPD_APPROVED: t("CPD approved"),
    CPD_SUBMITTED: t("CPD submitted"),
    CPD_REJECTED: t("CPD rejected"),
    COMPETENCY_ASSESSED: t("Competency assessed"),
    PLAN_REVIEWED: t("Plan reviewed"),
    ENROLLED: t("Enrolled"),
    LESSON_COMPLETED: t("Lesson completed"),
    WEBINAR_REGISTERED: t("Webinar registered"),
    PATH_STARTED: t("Path started"),
  };
  const label = (type: string) => LABEL[type] ?? sentence(type);
  const actor = await requireActor();
  const sp = await searchParams;
  const type = TYPES.includes(sp.type as never) ? (sp.type as (typeof TYPES)[number]) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { userId: actor.id, ...(type ? { type } : {}) };
  const [total, events] = await Promise.all([prisma.learningActivityEvent.count({ where }), prisma.learningActivityEvent.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * 25, take: 25 })]);
  return (
    <div>
      <PageHeader eyebrow={t("Development")} title={t("Learning History")} description={t("A complete, chronological record of your learning activity.")} actions={<><LinkButton href="/api/v1/exports/history" variant="secondary">{t("Download history (CSV)")}</LinkButton><LinkButton href="/api/v1/exports/completions" variant="secondary">{t("Completion records (CSV)")}</LinkButton></>} />
      <form className="mb-4 flex items-end gap-2" action="/history">
        <div><label htmlFor="type" className="type-eyebrow block">{t("Activity type")}</label><select id="type" name="type" defaultValue={type ?? ""} className="input-base h-9 !py-1"><option value="">{t("All activity")}</option>{TYPES.map((ty) => <option key={ty} value={ty}>{label(ty)}</option>)}</select></div>
        <button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">{t("Filter")}</button>
      </form>
      <Panel bodyClassName="pt-0">
        <Table caption={t("Learning history")}>
          <thead><tr><Th>{t("Date")}</Th><Th>{t("Activity")}</Th><Th>{t("Details")}</Th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.id}><Td className="whitespace-nowrap">{fmtDate(e.occurredAt)}</Td><Td className="whitespace-nowrap">{label(e.type)}</Td><Td>{e.summary}</Td></tr>)}</tbody>
        </Table>
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/history?${type ? `type=${type}&` : ""}page=${p}`} />
      </Panel>
    </div>
  );
}
