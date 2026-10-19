import { z } from "zod";
import { apiRoute, jsonBody } from "@/server/api";
import { recordLessonView } from "@/server/services/learning";

export const POST = apiRoute<{ id: string }>(async (req, actor, { id }) => {
  const b = z.object({ seconds: z.number().int().min(0).max(600).default(0), videoPosition: z.number().min(0).optional() }).parse(await jsonBody(req));
  await recordLessonView(actor, id, b);
  return { recorded: true };
});
