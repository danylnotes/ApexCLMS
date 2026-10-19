import { apiRoute, jsonBody } from "@/server/api";
import { submitAssessment } from "@/server/services/learning";

export const POST = apiRoute<{ id: string }>(async (req, actor, { id }) => {
  const body = await jsonBody<{ answers: unknown }>(req);
  const a = await submitAssessment(actor, id, body.answers);
  return { id: a.id, attemptNumber: a.attemptNumber, status: a.status, percent: a.percent, passed: a.passed };
});
