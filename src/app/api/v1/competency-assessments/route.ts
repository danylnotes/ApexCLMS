import { apiRoute, jsonBody } from "@/server/api";
import { recordAssessment } from "@/server/services/competency";

export const POST = apiRoute(async (req, actor) => recordAssessment(actor, await jsonBody(req)));
