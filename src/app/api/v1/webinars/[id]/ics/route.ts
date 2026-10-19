import { apiRoute } from "@/server/api";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { webinarIcs } from "@/server/services/webinars";

export const GET = apiRoute<{ id: string }>(async (req, _actor, { id }) => {
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.status === "DRAFT") throw notFound("Webinar");
  const ics = webinarIcs(w, process.env.APP_URL ?? req.nextUrl.origin);
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${w.code}.ics"` } });
});
