import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { employeeOverview } from "@/server/services/overview";
import { EmptyState, LinkButton, PageHeader, Panel, Progress, Status, TabNav, Table, Td, Th } from "@/components/ui";
import { mandatoryState } from "@/lib/domain/compliance";
import { ENROLLMENT, MANDATORY } from "@/lib/status";
import { fmtDate, fmtMinutes, fmtRelative } from "@/lib/format";
import { COMPLIANCE_METHOD } from "@/lib/domain/compliance";

export const metadata = { title: "My Learning" };

export default async function MyLearningPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requireActor();
  const { tab = "active" } = await searchParams;
  const o = await employeeOverview(actor.id);
  const active = o.courseRows.filter((r) => r.enrollment.status === "ACTIVE" || r.enrollment.status === "PENDING_APPROVAL");
  const completed = o.courseRows.filter((r) => r.enrollment.status === "COMPLETED").sort((a, b) => (b.enrollment.completedAt?.getTime() ?? 0) - (a.enrollment.completedAt?.getTime() ?? 0));
  const assigned = o.assignments.filter((a) => !a.isMandatory);
  const tabs = [
    { key: "active", label: "In progress", href: "/my-learning", count: active.length },
    { key: "assigned", label: "Assigned and recommended", href: "/my-learning?tab=assigned", count: assigned.filter((a) => a.status === "ASSIGNED").length },
    { key: "mandatory", label: "Mandatory training", href: "/my-learning?tab=mandatory", count: o.mandatory.filter((m) => m.status === "ASSIGNED").length },
    { key: "completed", label: "Completed", href: "/my-learning?tab=completed", count: completed.length },
  ];
  return (
    <div>
      <PageHeader eyebrow="Learning" title="My Learning" description="Your enrolments, assignments and mandatory requirements in one place." actions={<LinkButton href="/catalogue" variant="secondary">Browse catalogue</LinkButton>} />
      <TabNav tabs={tabs} current={tab} />

      {tab === "active" && (
        active.length === 0 ? <EmptyState title="No courses in progress" action={<LinkButton href="/catalogue" size="sm">Find a course</LinkButton>} /> : (
          <Panel bodyClassName="pt-0">
            <Table caption="Courses in progress">
              <thead><tr><Th>Course</Th><Th>Progress</Th><Th>Last accessed</Th><Th>Due</Th><Th /></tr></thead>
              <tbody>
                {active.map((r) => {
                  const [label, tone] = ENROLLMENT[r.enrollment.status];
                  return (
                    <tr key={r.enrollment.id}>
                      <Td><Link href={`/courses/${r.course.slug}`} className="font-medium">{r.course.title}</Link><div className="type-meta">{r.course.category.name} · {r.course.code}</div></Td>
                      <Td className="w-48">{r.enrollment.status === "PENDING_APPROVAL" ? <Status tone={tone}>{label}</Status> : <><Progress value={r.percent} label={`${r.course.title} progress`} /><div className="type-meta">{r.remainingMinutes != null ? `${fmtMinutes(r.remainingMinutes)} left` : ""}</div></>}</Td>
                      <Td>{fmtRelative(r.enrollment.lastAccessedAt)}</Td>
                      <Td>{r.enrollment.dueDate ? <span className={r.enrollment.dueDate < o.computedAt ? "font-medium text-crit" : ""}>{fmtDate(r.enrollment.dueDate)}</span> : "—"}</Td>
                      <Td align="right">{r.enrollment.status === "ACTIVE" && <LinkButton href={`/learn/${r.course.slug}`} size="sm" variant="secondary">{r.completedLessons ? "Continue" : "Start"}</LinkButton>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Panel>
        )
      )}

      {tab === "assigned" && (
        assigned.length === 0 ? <EmptyState title="Nothing assigned">Learning assigned or recommended by your manager or L&amp;D will appear here.</EmptyState> : (
          <Panel bodyClassName="pt-0">
            <Table caption="Assigned learning">
              <thead><tr><Th>Learning</Th><Th>Type</Th><Th>Assigned by</Th><Th>Due</Th><Th>Status</Th></tr></thead>
              <tbody>
                {assigned.map((a) => (
                  <tr key={a.id}>
                    <Td><Link href={a.course ? `/courses/${a.course.slug}` : `/learning-paths/${a.path?.slug}`} className="font-medium">{a.course?.title ?? a.path?.title}</Link>{a.reason && <div className="type-meta">{a.reason}</div>}</Td>
                    <Td>{a.kind === "REQUIRED" ? "Required" : "Recommended"} {a.path ? "path" : "course"}</Td>
                    <Td>{a.assignedBy.name}</Td>
                    <Td>{fmtDate(a.dueDate)}</Td>
                    <Td>{a.status === "COMPLETED" ? <Status tone="ok">Completed</Status> : a.status === "CANCELLED" ? <Status tone="idle">Cancelled</Status> : a.dueDate && a.dueDate < o.computedAt ? <Status tone="crit">Overdue</Status> : <Status tone="info">Open</Status>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )
      )}

      {tab === "mandatory" && (
        <div className="space-y-4">
          <p className="max-w-3xl text-[0.875rem] text-ink-muted">Compliance rate: <b className="text-ink">{o.compliance.ratePercent == null ? "—" : `${o.compliance.ratePercent}%`}</b>. {COMPLIANCE_METHOD}</p>
          {o.mandatory.length === 0 ? <EmptyState title="No mandatory training assigned" /> : (
            <Panel bodyClassName="pt-0">
              <Table caption="Mandatory training">
                <thead><tr><Th>Course</Th><Th>Assigned</Th><Th>Due</Th><Th>Completed</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>
                  {o.mandatory.map((a) => {
                    const [label, tone] = MANDATORY[mandatoryState(a, o.computedAt)];
                    return (
                      <tr key={a.id}>
                        <Td><Link href={`/courses/${a.course?.slug}`} className="font-medium">{a.course?.title}</Link>{a.reason && <div className="type-meta">{a.reason}</div>}</Td>
                        <Td>{fmtDate(a.createdAt)}</Td>
                        <Td>{fmtDate(a.dueDate)}</Td>
                        <Td>{fmtDate(a.completedAt)}</Td>
                        <Td><Status tone={tone}>{label}</Status></Td>
                        <Td align="right">{a.status === "ASSIGNED" && a.course && <LinkButton href={`/courses/${a.course.slug}`} size="sm" variant={tone === "crit" ? "primary" : "secondary"}>Open</LinkButton>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Panel>
          )}
        </div>
      )}

      {tab === "completed" && (
        completed.length === 0 ? <EmptyState title="No completed courses yet" /> : (
          <Panel bodyClassName="pt-0">
            <Table caption="Completed courses">
              <thead><tr><Th>Course</Th><Th>Completed</Th><Th align="right">Recorded time</Th><Th /></tr></thead>
              <tbody>
                {completed.map((r) => (
                  <tr key={r.enrollment.id}>
                    <Td><Link href={`/courses/${r.course.slug}`} className="font-medium">{r.course.title}</Link><div className="type-meta">{r.course.code}{r.enrollment.cycle > 1 ? ` · cycle ${r.enrollment.cycle}` : ""}</div></Td>
                    <Td>{fmtDate(r.enrollment.completedAt)}</Td>
                    <Td align="right">{fmtMinutes(Math.round(r.enrollment.timeSpentSeconds / 60))}</Td>
                    <Td align="right"><LinkButton href={`/learn/${r.course.slug}`} size="sm" variant="ghost">Review</LinkButton></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )
      )}
    </div>
  );
}
