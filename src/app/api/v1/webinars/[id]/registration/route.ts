import { apiRoute } from "@/server/api";
import { cancelRegistration, register } from "@/server/services/webinars";

export const POST = apiRoute<{ id: string }>(async (_req, actor, { id }) => register(actor, id));
export const DELETE = apiRoute<{ id: string }>(async (_req, actor, { id }) => {
  await cancelRegistration(actor, id);
  return { cancelled: true };
});
