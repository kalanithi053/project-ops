import { useAuthStore } from "@/lib/store/auth-store";
import { API_BASE_URL, WORKSPACE_HEADER } from "./config";

/** Standard response envelope returned by every endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

/** Thrown when a request fails; carries the server message + status. */
export class ApiError extends Error {
  statusCode: number;
  /** Domain signal slug when present (e.g. "Create-User"). */
  slug?: string;
  data?: unknown;

  constructor(
    message: string,
    statusCode: number,
    slug?: string,
    data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.slug = slug;
    this.data = data;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (typeof source[key] === "string") return source[key] as string;
  }
  return undefined;
}

/**
 * Pull an access/refresh token pair out of an OTP-verify or refresh
 * response, tolerating a few common field-name shapes so we don't couple
 * tightly to one backend convention.
 */
export function extractTokens(data: unknown): {
  accessToken?: string;
  refreshToken?: string;
} {
  const root = asRecord(data);
  const nested = asRecord(root.tokens ?? root);
  return {
    accessToken:
      pickString(nested, "accessToken", "access_token") ??
      pickString(root, "accessToken", "access_token"),
    refreshToken:
      pickString(nested, "refreshToken", "refresh_token") ??
      pickString(root, "refreshToken", "refresh_token"),
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sets the `x-workspace-slug` header for workspace-scoped routes. */
  workspaceSlug?: string;
  /** Set false for public routes (no Authorization header). */
  auth?: boolean;
}

function buildHeaders(opts: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  // FormData must set its own Content-Type: the browser appends the multipart
  // boundary, and overriding it makes the body unparseable server-side.
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.auth !== false) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (opts.workspaceSlug) headers[WORKSPACE_HEADER] = opts.workspaceSlug;
  return headers;
}

function buildBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: buildHeaders(opts),
    body: buildBody(opts.body),
  });
}

/**
 * Fetches a file as a Blob instead of JSON.
 *
 * Attachment downloads go through the authenticated API rather than a public
 * folder, so a plain <a href> can't carry the bearer token — the bytes have
 * to be fetched and handed to the browser as an object URL.
 */
export async function apiDownload(
  path: string,
  opts: { workspaceSlug?: string } = {},
): Promise<Blob> {
  let res = await rawFetch(path, opts);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, opts);
  }

  if (!res.ok) {
    throw new ApiError(`Download failed (${res.status})`, res.status);
  }

  return res.blob();
}

/** Exchange the stored refresh token for a fresh token pair. */
async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    return false;
  }
  try {
    const res = await rawFetch("/auth/token/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    });
    const json = (await res
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;
    if (!res.ok || !json?.success) {
      clear();
      return false;
    }
    const tokens = extractTokens(json.data);
    if (!tokens.accessToken) {
      clear();
      return false;
    }
    setTokens(tokens.accessToken, tokens.refreshToken ?? refreshToken);
    return true;
  } catch {
    clear();
    return false;
  }
}

/**
 * Perform an API request and return the unwrapped `data`. Throws
 * `ApiError` on a failed/non-2xx response. On a 401 it transparently
 * attempts a single token refresh and retries once.
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  let res = await rawFetch(path, opts);

  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, opts);
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !json || json.success === false) {
    const slug = pickString(asRecord(json?.data), "slug");
    throw new ApiError(
      json?.message || `Request failed (${res.status})`,
      json?.statusCode ?? res.status,
      slug,
      json?.data,
    );
  }

  return json.data;
}
