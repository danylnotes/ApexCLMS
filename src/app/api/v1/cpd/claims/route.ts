import { apiRoute, jsonBody, pageParams } from "@/server/api";
import { prisma } from "@/server/db";
import { createClaim } from "@/server/services/cpd";

export const GET = apiRoute(async (req, actor) => {
  const { skip, take, page } = pageParams(req);
  const status = req.nextUrl.searchParams.get("status");
  const where = { userId: actor.id, ...(status ? { status: status as never } : {}) };
  const [total, items] = await Promise.all([prisma.cpdClaim.count({ where }), prisma.cpdClaim.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { activity: true } })]);
  return { items, page, total };
});

export const POST = apiRoute(async (req, actor) => createClaim(actor, await jsonBody(req)));
