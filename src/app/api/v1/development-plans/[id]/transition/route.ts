import { z } from "zod";
import { apiRoute, jsonBody } from "@/server/api";
import { transitionPlan } from "@/server/services/plans";

export const POST = apiRoute<{ id: string }>(async (req, actor, { id }) => {
  const b = z.object({ to: z.enum(["DRAFT", "EMPLOYEE_REVIEW", "MANAGER_REVIEW", "AGREED", "IN_PROGRESS", "COMPLETED"]), comment: z.string().max(2000).optional() }).parse(await jsonBody(req));
  await transitionPlan(actor, id, b.to, b.comment);
  return { ok: true };
});
