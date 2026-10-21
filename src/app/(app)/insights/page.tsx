import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/policy";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";
import { AnalyticsFiltersForm, AnalyticsView } from "@/components/analytics-view";
import { Notice, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Organisational Insights") };
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePagePermission("analytics.aggregate");
  const { t } = await getI18n();
  const sp = await searchParams;
  const now = new Date();
  const individual = can(actor, "reports.org");
  const a = await computeAnalytics(null, parseAnalyticsFilters(sp, new Date(now.getFullYear(), 0, 1), now), { minGroupSize: individual ? 1 : 3 });
  return (
    <div>
      <PageHeader eyebrow={t("Insights")} title={t("Organisational Insights")} description={t("Workforce capability, compliance and development trends across the organisation.")} />
      {!individual && <div className="mb-6"><Notice tone="info" title={t("Aggregated view")}>{t("Individual employee records are not shown. Departments with fewer than three employees are suppressed to protect confidentiality.")}</Notice></div>}
      <AnalyticsFiltersForm action="/insights" sp={sp} showEmployment={individual} />
      <AnalyticsView a={a} showExpiryNames={individual} />
    </div>
  );
}
