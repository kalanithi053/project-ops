import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { safeAuthDestination } from "@/lib/auth/redirect";

/**
 * Route protection based on the auth cookie (Next.js `proxy` convention,
 * formerly `middleware`).
 *
 * - Signed-out users hitting any app route are sent to `/login`.
 * - Signed-in users hitting `/login` (or `/`) are sent to `/workspaces`.
 *
 * The `matcher` excludes the API proxy, Next internals, and static files
 * so only real page navigations are gated. This is a UX gate; the backend
 * still authorizes every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasToken ? "/workspaces" : "/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    if (hasToken) {
      const url = request.nextUrl.clone();
      url.pathname = safeAuthDestination(request.nextUrl.searchParams.get("next"));
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
