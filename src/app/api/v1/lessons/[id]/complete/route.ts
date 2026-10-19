import { apiRoute } from "@/server/api";
import { completeLesson } from "@/server/services/learning";

export const POST = apiRoute<{ id: string }>(async (_req, actor, { id }) => completeLesson(actor, id));
