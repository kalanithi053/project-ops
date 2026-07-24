/**
 * Cookie names + client-side cookie helpers for the auth session.
 *
 * The token is delivered by the backend in the verify/refresh response
 * body and stored in a cookie by the frontend, so that:
 *  - Next.js middleware (server) can read it for route protection, and
 *  - it survives refreshes without localStorage.
 *
 * NOTE: these are JS-set (non-HttpOnly) cookies. For production, prefer
 * the backend setting an HttpOnly cookie directly.
 */
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const DEFAULT_MAX_AGE_DAYS = 30;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(
  name: string,
  value: string,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${
    maxAgeDays * 24 * 60 * 60
  }; samesite=lax${secure}`;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}
