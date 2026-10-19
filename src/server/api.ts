import { NextResponse, type NextRequest } from "next/server";
import { resolveSession, SESSION_COOKIE, type Actor } from "./auth/session";
import { AppError, toErrorBody } from "./errors";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps an API route: consistent JSON errors, authentication from the session cookie,
 * and same-origin enforcement for state-changing methods (CSRF protection; cookies are SameSite=Lax as well).
 */
export function apiRoute<P = Record<string, string>>(fn: (req: NextRequest, actor: Actor, params: P) => Promise<Response | unknown>, opts: { public?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      let actor: Actor | null = null;
      if (!opts.public) {
        const s = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
        if (!s.actor) throw new AppError("UNAUTHENTICATED", s.reason === "expired" ? "Your session has expired." : "Sign in required.");
        actor = s.actor;
      }
      const out = await fn(req, actor as Actor, await ctx.params);
      if (out instanceof Response) return out;
      return NextResponse.json({ data: out });
    } catch (e) {
      const { status, body } = toErrorBody(e);
      return NextResponse.json(body, { status });
    }
  };
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (no ambient credentials risk beyond the cookie, which is SameSite=Lax)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    ok = new URL(origin).host === host || (!!process.env.APP_URL && new URL(origin).origin === new URL(process.env.APP_URL).origin);
  } catch {
    ok = false;
  }
  if (!ok) throw new AppError("FORBIDDEN", "Cross-origin request rejected.");
}

export async function jsonBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON.");
  }
}

export function pageParams(req: NextRequest, max = 100) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(max, Math.max(1, Number(sp.get("pageSize") ?? 20) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function csvResponse(filename: string, rows: (string | number | null | undefined | Date)[][]) {
  const cell = (v: unknown) => {
    if (v == null) return "";
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}

export function pdfResponse(filename: string, bytes: Uint8Array, inline = false) {
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
