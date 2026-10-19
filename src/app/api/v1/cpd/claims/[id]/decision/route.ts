import { apiRoute, jsonBody } from "@/server/api";
import { reviewClaim } from "@/server/services/cpd";

export const POST = apiRoute<{ id: string }>(async (req, actor, { id }) => {
  const body = await jsonBody<Record<string, unknown>>(req);
  await reviewClaim(actor, { ...body, claimId: id });
  return { ok: true };
});
