import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** Switches the interface language: /lang?set=ar&next=/dashboard. Works without JavaScript. */
export function GET(req: NextRequest) {
  const set = req.nextUrl.searchParams.get("set");
  const nextRaw = req.nextUrl.searchParams.get("next") ?? "/";
  // Only same-site paths, never protocol-relative URLs.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\") ? nextRaw : "/";
  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303);
  if (isLocale(set)) {
    res.cookies.set(LOCALE_COOKIE, set, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true" });
  }
  return res;
}
