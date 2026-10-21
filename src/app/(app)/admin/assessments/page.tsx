import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { LinkButton, PageHeader, Panel, Table, Td, Th } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Assessment Management") };
}

export default async function AssessmentsAdmin() {
  await requirePagePermission("assessment.manage", "course.manage");
  const { t } = await getI18n();
  const items = await prisma.assessment.findMany({
    orderBy: { course: { code: "asc" } },
    include: { course: { select: { id: true, code: true, title: true } }, _count: { select: { questions: true } }, attempts: { select: { status: true, passed: true, attemptNumber: true, percent: true } } },
  });
  return (
    <div>
      <PageHeader eyebrow={t("Administration")} title={t("Assessment Management")} description={t("All course assessments with outcome statistics. Edit questions and settings from the course editor.")} actions={<LinkButton href="/teaching" variant="secondary">{t("Grading queue")}</LinkButton>} />
      <Panel bodyClassName="pt-0">
        <Table caption={t("Assessments")}>
          <thead><tr><Th>{t("Assessment")}</Th><Th>{t("Course")}</Th><Th align="right">{t("Questions")}</Th><Th align="right">{t("Pass mark")}</Th><Th align="right">{t("Graded attempts")}</Th><Th align="right">{t("Pass rate")}</Th><Th align="right">{t("First-attempt pass")}</Th><Th align="right">{t("Awaiting grading")}</Th></tr></thead>
          <tbody>
            {items.map((a) => {
              const graded = a.attempts.filter((x) => x.status === "GRADED");
              const first = graded.filter((x) => x.attemptNumber === 1);
              const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
              return (
                <tr key={a.id}>
                  <Td className="font-medium">{a.title}{a.isFinal && <span className="type-meta"> · {t("final")}</span>}</Td>
                  <Td><Link href={`/admin/courses/${a.course.id}?tab=assessments`}>{a.course.code}</Link></Td>
                  <Td align="right">{a._count.questions}</Td>
                  <Td align="right">{a.passingScore}%</Td>
                  <Td align="right">{graded.length}</Td>
                  <Td align="right">{pct(graded.filter((x) => x.passed).length, graded.length)}</Td>
                  <Td align="right">{pct(first.filter((x) => x.passed).length, first.length)}</Td>
                  <Td align="right">{a.attempts.filter((x) => x.status === "PENDING_REVIEW").length}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
