import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { webinarPhase } from "@/server/services/webinars";
import { EmptyState, PageHeader, Panel, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { WEBINAR_PHASE } from "@/lib/status";
import { fmtDateTime, fmtMinutes, fmtNum } from "@/lib/format";

export const metadata = { title: "Webinars and Events" };

export default async function WebinarsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requireActor();
  const { tab = "upcoming" } = await searchParams;
  const now = new Date();
  const webinars = await prisma.webinar.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { startsAt: tab === "past" ? "desc" : "asc" },
    include: { category: true, registrations: { where: { userId: actor.id }, include: { attendance: { include: { cpdActivity: { include: { claims: true } } } } } }, recordings: true, _count: { select: { registrations: { where: { status: "REGISTERED" } } } } },
  });
  const withPhase = webinars.map((w) => ({ ...w, phase: webinarPhase(w, now), mine: w.registrations[0] }));
  const upcoming = withPhase.filter((w) => w.phase === "UPCOMING" || w.phase === "LIVE" || (w.phase === "CANCELLED" && w.startsAt > now));
  const past = withPhase.filter((w) => w.phase === "COMPLETED");
  const mine = withPhase.filter((w) => w.mine && w.mine.status !== "CANCELLED").sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const tabs = [
    { key: "upcoming", label: "Upcoming and live", href: "/webinars", count: upcoming.length },
    { key: "past", label: "Past sessions", href: "/webinars?tab=past", count: past.length },
    { key: "mine", label: "My webinar history", href: "/webinars?tab=mine", count: mine.length },
  ];
  const list = tab === "past" ? past : upcoming;
  return (
    <div>
      <PageHeader eyebrow="Learning" title="Webinars and Events" description="Live technical sessions, recordings and verified attendance. Registration does not by itself count as attendance — attendance is recorded and verified after each session." />
      <TabNav tabs={tabs} current={tab} />
      {tab !== "mine" ? (
        list.length === 0 ? <EmptyState title="No sessions to show" /> : (
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {list.map((w) => {
              const [label, tone] = WEBINAR_PHASE[w.phase];
              return (
                <li key={w.id} className="grid gap-x-8 gap-y-2 px-5 py-5 md:grid-cols-[150px_minmax(0,1fr)_180px]">
                  <div className="font-sans">
                    <p className="text-[0.75rem] uppercase tracking-wide text-ink-faint">{w.startsAt.toLocaleDateString("en-GB", { weekday: "short", timeZone: w.timeZone })}</p>
                    <p className="text-[1.375rem] font-semibold leading-tight text-navy">{w.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: w.timeZone })}</p>
                    <p className="text-[0.8125rem] text-ink-muted">{w.startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: w.timeZone })} · {fmtMinutes(w.durationMinutes)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="type-eyebrow">{w.category?.name ?? "General"} · {w.code}</p>
                    <h2 className="mt-0.5 font-serif text-[1.0625rem] font-semibold"><Link href={`/webinars/${w.slug}`} className="text-navy no-underline hover:underline">{w.title}</Link></h2>
                    <p className="mt-0.5 text-[0.875rem] text-ink-muted">{w.speakerName}{w.speakerTitle ? `, ${w.speakerTitle}` : ""}</p>
                    <p className="mt-1 line-clamp-2 text-[0.875rem] text-ink-muted">{w.synopsis}</p>
                  </div>
                  <div className="flex flex-col items-start gap-1.5 md:items-end">
                    <Status tone={tone}>{label}</Status>
                    {w.mine && w.mine.status !== "CANCELLED" && <Status tone={w.mine.status === "WAITLISTED" ? "warn" : "ok"} glyph={false}>{w.mine.status === "WAITLISTED" ? "Waitlisted" : "Registered"}</Status>}
                    {w.mine?.attendance?.attended && <Status tone="ok" glyph={false}>Attended</Status>}
                    <span className="type-meta">{w.cpdEligible ? `CPD ${fmtNum(w.cpdValue?.toString())} h if attended` : "No CPD"}</span>
                    {w.capacity != null && w.phase === "UPCOMING" && <span className="type-meta">{Math.max(w.capacity - w._count.registrations, 0)} of {w.capacity} places left</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <Panel bodyClassName="pt-0">
          {mine.length === 0 ? <div className="pt-4"><EmptyState title="No webinar registrations yet" /></div> : (
            <Table caption="My webinar history">
              <thead><tr><Th>Webinar</Th><Th>Date</Th><Th>Registration</Th><Th>Attendance</Th><Th>CPD</Th><Th>Recording</Th></tr></thead>
              <tbody>
                {mine.map((w) => {
                  const a = w.mine!.attendance;
                  const claim = a?.cpdActivity?.claims[0];
                  return (
                    <tr key={w.id}>
                      <Td><Link href={`/webinars/${w.slug}`} className="font-medium">{w.title}</Link></Td>
                      <Td>{fmtDateTime(w.startsAt, w.timeZone)}</Td>
                      <Td>{w.mine!.status === "WAITLISTED" ? "Waitlisted" : "Registered"}</Td>
                      <Td>{!a ? (w.phase === "COMPLETED" ? <span className="text-ink-muted">Not yet recorded</span> : "—") : a.attended ? <>{a.attendedMinutes ?? "—"} min · {a.verification === "UNVERIFIED" ? <Status tone="warn">Unverified</Status> : <Status tone="ok">Verified</Status>}</> : <Status tone="idle">Did not attend</Status>}</Td>
                      <Td>{claim ? <Link href={`/cpd/${claim.id}`}>{claim.status === "APPROVED" ? `${fmtNum(claim.approvedValue?.toString())} approved` : "Claim pending"}</Link> : "—"}</Td>
                      <Td>{w.recordings.length ? <a href={w.recordings[0].url} target="_blank" rel="noopener noreferrer">Watch</a> : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
    </div>
  );
}
