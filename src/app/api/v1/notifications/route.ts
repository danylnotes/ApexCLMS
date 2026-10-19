import { apiRoute, pageParams } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = apiRoute(async (req, actor) => {
  const { skip, take, page } = pageParams(req);
  const unread = req.nextUrl.searchParams.get("unread") === "true";
  const where = { userId: actor.id, ...(unread ? { readAt: null } : {}) };
  const [total, items] = await Promise.all([prisma.notification.count({ where }), prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take })]);
  return { items, page, total };
});
