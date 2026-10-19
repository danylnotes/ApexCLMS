import { apiRoute } from "@/server/api";
import { clearSessionCookie, revokeSession } from "@/server/auth/session";

export const POST = apiRoute(async (_req, actor) => {
  await revokeSession(actor.sessionId);
  await clearSessionCookie();
  return { signedOut: true };
});
