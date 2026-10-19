import { z } from "zod";
import { apiRoute, jsonBody } from "@/server/api";
import { enrol } from "@/server/services/learning";

export const POST = apiRoute(async (req, actor) => {
  const { courseId } = z.object({ courseId: z.string() }).parse(await jsonBody(req));
  return enrol(actor, courseId);
});
