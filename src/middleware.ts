import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/verify", "/session-expired", "/sso", "/access-denied", "/api/v1/health", "/api/v1/auth/login", "/api/v1/jobs/run"];

/**
 * Edge pre-check only: redirects requests without a session cookie to sign-in.
 * Authoritative session validation and authorisation happen on the server for every request.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/")) || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (!req.cookies.get("apex_session")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
