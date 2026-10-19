import { apiRoute, jsonBody } from "@/server/api";
import { recordAttendance } from "@/server/services/webinars";

export const POST = apiRoute<{ id: string }>(async (req, actor, { id }) => {
  const body = await jsonBody<{ entries: unknown }>(req);
  return recordAttendance(actor, { webinarId: id, entries: body.entries });
});
