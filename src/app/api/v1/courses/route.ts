import { apiRoute } from "@/server/api";
import { searchCatalogue } from "@/server/services/catalogue";

export const GET = apiRoute(async (req, actor) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const r = await searchCatalogue(actor.id, { ...sp, page: Number(sp.page ?? 1), pageSize: Math.min(50, Number(sp.pageSize ?? 12)) });
  return { items: r.items.map((c) => ({ ...c, estimatedHours: Number(c.estimatedHours), cpdValue: c.cpdValue == null ? null : Number(c.cpdValue) })), page: r.page, pages: r.pages, total: r.total };
});
