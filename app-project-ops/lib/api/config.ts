/**
 * Base path the BROWSER uses for API calls. This is intentionally the
 * app's OWN origin (relative `/api/v1`) so every request goes through the
 * Next.js rewrite proxy (see next.config.ts). That keeps calls same-origin
 * — no CORS, and the auth cookie stays first-party.
 *
 * The proxy's UPSTREAM (the real backend, e.g. http://localhost:3000/api/v1)
 * is configured separately in next.config.ts via NEXT_PUBLIC_API_BASE_URL.
 * Do NOT point this browser base at that absolute URL, or the browser would
 * call the backend cross-origin directly and hit CORS / connection errors.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

/** Header the backend reads to scope a request to the active workspace. */
export const WORKSPACE_HEADER = "x-workspace-slug";
