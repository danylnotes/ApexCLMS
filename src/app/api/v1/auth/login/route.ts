import { z } from "zod";
import { apiRoute, jsonBody } from "@/server/api";
import { authenticate } from "@/server/services/auth";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { AppError } from "@/server/errors";

const schema = z.object({ staffId: z.string().trim().min(3).max(30), password: z.string().min(1) });

export const POST = apiRoute(async (req) => {
  const { staffId, password } = schema.parse(await jsonBody(req));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const r = await authenticate(staffId, password, ip);
  if (!r.ok) throw new AppError("UNAUTHENTICATED", r.error);
  const { token, expiresAt } = await createSession(r.userId, { ip, userAgent: req.headers.get("user-agent") });
  await setSessionCookie(token, expiresAt);
  return { userId: r.userId, expiresAt };
}, { public: true });
