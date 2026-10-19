import { z } from "zod";
import { apiRoute, jsonBody } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = apiRoute(async (req, actor) => {
  const { ids } = z.object({ ids: z.array(z.string()).optional() }).parse(await jsonBody(req));
  const r = await prisma.notification.updateMany({ where: { userId: actor.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  return { updated: r.count };
});
