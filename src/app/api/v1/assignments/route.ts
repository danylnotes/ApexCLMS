import { apiRoute, jsonBody } from "@/server/api";
import { assignLearning } from "@/server/services/assignments";

export const POST = apiRoute(async (req, actor) => assignLearning(actor, await jsonBody(req)));
