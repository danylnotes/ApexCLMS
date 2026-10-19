import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Pagination, Panel, Table, Td, Th } from "@/components/ui";
import { fmtDate, sentence } from "@/lib/format";

export const metadata = { title: "Learning History" };

const TYPES = ["COURSE_COMPLETED", "ASSESSMENT_PASSED", "ASSESSMENT_FAILED", "CERTIFICATE_ISSUED", "WEBINAR_ATTENDED", "CPD_APPROVED", "CPD_SUBMITTED", "CPD_REJECTED", "COMPETENCY_ASSESSED", "PLAN_REVIEWED", "ENROLLED", "LESSON_COMPLETED", "WEBINAR_REGISTERED", "PATH_STARTED"] as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const type = TYPES.includes(sp.type as never) ? (sp.type as (typeof TYPES)[number]) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { userId: actor.id, ...(type ? { type } : {}) };
  const [total, events] = await Promise.all([prisma.learningActivityEvent.count({ where }), prisma.learningActivityEvent.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * 25, take: 25 })]);
  return (
    <div>
      <PageHeader eyebrow="Development" title="Learning History" description="A complete, chronological record of your learning activity." actions={<><LinkButton href="/api/v1/exports/history" variant="secondary">Download history (CSV)</LinkButton><LinkButton href="/api/v1/exports/completions" variant="secondary">Completion records (CSV)</LinkButton></>} />
      <form className="mb-4 flex items-end gap-2" action="/history">
        <div><label htmlFor="type" className="type-eyebrow block">Activity type</label><select id="type" name="type" defaultValue={type ?? ""} className="input-base h-9 !py-1"><option value="">All activity</option>{TYPES.map((t) => <option key={t} value={t}>{sentence(t)}</option>)}</select></div>
        <button className="h-9 rounded border border-line-strong bg-surface px-3 font-sans text-sm">Filter</button>
      </form>
      <Panel bodyClassName="pt-0">
        <Table caption="Learning history">
          <thead><tr><Th>Date</Th><Th>Activity</Th><Th>Details</Th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.id}><Td className="whitespace-nowrap">{fmtDate(e.occurredAt)}</Td><Td className="whitespace-nowrap">{sentence(e.type)}</Td><Td>{e.summary}</Td></tr>)}</tbody>
        </Table>
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} hrefFor={(p) => `/history?${type ? `type=${type}&` : ""}page=${p}`} />
      </Panel>
    </div>
  );
}
