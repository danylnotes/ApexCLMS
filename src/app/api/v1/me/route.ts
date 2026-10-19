import { apiRoute } from "@/server/api";
import { employeeOverview } from "@/server/services/overview";

export const GET = apiRoute(async (_req, actor) => {
  const o = await employeeOverview(actor.id);
  return {
    user: { id: actor.id, name: actor.name, email: actor.email, roles: actor.roles, permissions: [...actor.permissions] },
    metrics: o.metrics,
    compliance: o.compliance,
    health: o.health.map(({ key, title, status, evidence, gaps, nextAction, method }) => ({ key, title, status, evidence, gaps, nextAction, method })),
    computedAt: o.computedAt,
  };
});
