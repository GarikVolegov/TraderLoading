export const API_BASE = "/api";

export type RelativeApiOptions = {
  basePath?: string;
};

function getDefaultBasePath(): string {
  return ((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/").replace(/\/$/, "");
}

export function createApiUrl(path: string, basePath = getDefaultBasePath()): string {
  const normalizedBase = basePath.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\/+/, "").replace(/^api\//, "");
  return `${normalizedBase}/api/${normalizedPath}`;
}

/** Error carrying the HTTP status, so the query retry can tell 4xx (don't retry)
 *  from transient 5xx/network (retry) — matches ApiError from the generated client. */
function apiError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

export async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw apiError(err.error ?? `HTTP ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

export function apiRequest(path: string, opts?: RequestInit, options?: RelativeApiOptions): Promise<Response> {
  return fetch(createApiUrl(path, options?.basePath), { credentials: "include", ...opts });
}

export async function apiJSON<T>(path: string, opts?: RequestInit, options?: RelativeApiOptions): Promise<T> {
  const res = await apiRequest(path, opts, options);
  if (!res.ok) {
    // Surface the server's {error} message like apiFetch/apiUpload, so off-contract
    // callers show the real reason instead of a bare status code.
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof body?.error === "string" && body.error ? body.error : `HTTP ${res.status}`;
    throw apiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", credentials: "include", body: form });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw apiError(err.error ?? `HTTP ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}
