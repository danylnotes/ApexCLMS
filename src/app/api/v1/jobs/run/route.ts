import { timingSafeEqual } from "node:crypto";
import { apiRoute } from "@/server/api";
import { AppError } from "@/server/errors";
import { runScheduledJobs } from "@/server/services/jobs";

/** Triggered by an external scheduler with `Authorization: Bearer $JOBS_SECRET`. */
export const POST = apiRoute(async (req) => {
  const secret = process.env.JOBS_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 12 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw new AppError("UNAUTHENTICATED", "Invalid job credentials.");
  return runScheduledJobs();
}, { public: true });
