import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe: verifies database connectivity. No authentication, no sensitive data. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
