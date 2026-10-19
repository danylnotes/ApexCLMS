import { apiRoute } from "@/server/api";
import { forbidden } from "@/server/errors";
import { can, reportingScope } from "@/server/policy";
import { computeAnalytics, parseAnalyticsFilters } from "@/server/services/analytics";

/** scope=team (manager's reporting line) or scope=org (reports.org or analytics.aggregate; aggregate-only). */
export const GET = apiRoute(async (req, actor) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const scope = sp.scope === "org" ? "org" : "team";
  const now = new Date();
  const f = parseAnalyticsFilters(sp, new Date(now.getFullYear(), 0, 1), now);
  if (scope === "org") {
    if (!can(actor, "reports.org") && !can(actor, "analytics.aggregate")) throw forbidden();
    const a = await computeAnalytics(null, f, { minGroupSize: can(actor, "reports.org") ? 1 : 3 });
    return { ...a, expiries: can(actor, "reports.org") ? a.expiries : a.expiries.length };
  }
  if (!can(actor, "team.view")) throw forbidden();
  return computeAnalytics(await reportingScope(actor.id), f);
});
