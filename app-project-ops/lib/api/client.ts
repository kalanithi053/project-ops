import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
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
  /** Disable automatic API response toasts for this request. */
  notify?: boolean;
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

function responseMessage(message: unknown, fallback: string): string {
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    );
    if (messages.length) return messages.join(". ");
  }
  return fallback;
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
    const json = (await res
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;
    const message = responseMessage(
      json?.message,
      `Download failed (${res.status})`,
    );
    toast.apiError(message);
    throw new ApiError(message, res.status);
  }

  return res.blob();
}

/** Exchange the stored refresh token for a fresh token pair. */
export async function tryRefresh(): Promise<boolean> {
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

  // Still unauthorized after a refresh attempt (or there was nothing to
  // refresh): the session is unrecoverable. Clear the stale cookies/store
  // and hard-reload so the app re-boots into the signed-out state instead
  // of continuing to run against dead tokens.
  if (res.status === 401 && opts.auth !== false) {
    useAuthStore.getState().clear();
    if (typeof window !== "undefined") window.location.reload();
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !json || json.success === false) {
    const slug = pickString(asRecord(json?.data), "slug");
    const message = responseMessage(
      json?.message,
      `Request failed (${res.status})`,
    );
    if (opts.notify !== false) {
      toast.apiError(message);
    }
    throw new ApiError(
      message,
      json?.statusCode ?? res.status,
      slug,
      json?.data,
    );
  }

  // Successful reads happen frequently during page bootstrap and background
  // refreshes. Toast successful user-initiated writes; always toast failures.
  if ((opts.method ?? "GET") !== "GET" && opts.notify !== false) {
    toast.apiSuccess(
      responseMessage(json.message, "Request processed successfully"),
    );
  }

  return json.data;
}

function xhrHeaders(workspaceSlug?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = useAuthStore.getState().accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceSlug) headers[WORKSPACE_HEADER] = workspaceSlug;
  return headers;
}

function sendUpload<T>(
  path: string,
  formData: FormData,
  workspaceSlug: string | undefined,
  onProgress: ((percent: number) => void) | undefined,
): Promise<{ status: number; json: ApiEnvelope<T> | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    for (const [name, value] of Object.entries(xhrHeaders(workspaceSlug))) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let json: ApiEnvelope<T> | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

/**
 * Uploads a file as multipart/form-data via `XMLHttpRequest` instead of
 * `fetch` — `fetch` doesn't expose upload progress in a reliable,
 * widely-supported way, but `XMLHttpRequest.upload.onprogress` does. Mirrors
 * `apiFetch`'s envelope-unwrapping, 401-refresh-and-retry, and error-toast
 * behavior. Deliberately never auto-toasts success (unlike `apiFetch`) —
 * callers show their own toast once the upload (and any follow-up work,
 * like cache invalidation) is fully settled.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  opts: {
    workspaceSlug?: string;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<T> {
  let { status, json } = await sendUpload<T>(
    path,
    formData,
    opts.workspaceSlug,
    opts.onProgress,
  );

  if (status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ status, json } = await sendUpload<T>(
        path,
        formData,
        opts.workspaceSlug,
        opts.onProgress,
      ));
    }
  }

  if (status === 401) {
    useAuthStore.getState().clear();
    if (typeof window !== "undefined") window.location.reload();
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  if (status < 200 || status >= 300 || !json || json.success === false) {
    const message = responseMessage(json?.message, `Upload failed (${status})`);
    toast.apiError(message);
    throw new ApiError(message, json?.statusCode ?? status, undefined, json?.data);
  }

  return json.data;
}
