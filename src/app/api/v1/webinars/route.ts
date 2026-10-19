import { apiRoute, pageParams } from "@/server/api";
import { prisma } from "@/server/db";
import { webinarPhase } from "@/server/services/webinars";

export const GET = apiRoute(async (req, actor) => {
  const { skip, take, page } = pageParams(req, 50);
  const upcoming = req.nextUrl.searchParams.get("when") !== "past";
  const where = { status: { not: "DRAFT" as const }, startsAt: upcoming ? { gte: new Date(Date.now() - 3 * 3_600_000) } : { lt: new Date() } };
  const [total, items] = await Promise.all([
    prisma.webinar.count({ where }),
    prisma.webinar.findMany({ where, orderBy: { startsAt: upcoming ? "asc" : "desc" }, skip, take, select: { id: true, slug: true, code: true, title: true, synopsis: true, speakerName: true, startsAt: true, durationMinutes: true, timeZone: true, status: true, cpdEligible: true, cpdValue: true, registrations: { where: { userId: actor.id }, select: { status: true } } } }),
  ]);
  return { items: items.map((w) => ({ ...w, phase: webinarPhase(w), cpdValue: w.cpdValue == null ? null : Number(w.cpdValue), myRegistration: w.registrations[0]?.status ?? null, registrations: undefined })), page, total };
});
