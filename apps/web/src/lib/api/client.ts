import { ApiError, type ApiErrorBody } from "@cartsas/shared";
import { API_BASE_URL } from "./env";
import { readSession, writeSession } from "./session";

interface FetchOptions<TBody> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: TBody;
  /** When true, does NOT attach the Authorization header (public endpoints). */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

/**
 * Shared fetch wrapper. Every repo uses this so we have one place to:
 *   - Attach the bearer token
 *   - Serialize/deserialize JSON
 *   - Convert errors into ApiError with the standard envelope
 *   - Auto-logout on 401 (token expired)
 */
export async function apiFetch<TResp, TBody = unknown>(
  path: string,
  opts: FetchOptions<TBody> = {},
): Promise<TResp> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.anonymous) {
    const s = readSession();
    if (s) headers["Authorization"] = `Bearer ${s.accessToken}`;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401 && !opts.anonymous) writeSession(null);
    const body: ApiErrorBody =
      isJson && typeof payload === "object" && payload !== null
        ? (payload as ApiErrorBody)
        : {
            statusCode: res.status,
            code: "INTERNAL_ERROR",
            message: typeof payload === "string" ? payload : res.statusText,
          };
    throw new ApiError(body);
  }

  return payload as TResp;
}
