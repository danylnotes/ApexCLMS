import { prisma } from "./db";
import { AppError } from "./errors";

/** Fixed-window rate limiter persisted in PostgreSQL so it works across application instances. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; count: number }> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets ("key", "windowStart", "count") VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limit_buckets."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "windowStart" = CASE WHEN rate_limit_buckets."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limit_buckets."windowStart" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  return { ok: count <= limit, count };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.ok) throw new AppError("RATE_LIMITED", "Too many requests. Please wait a few minutes and try again.");
}
