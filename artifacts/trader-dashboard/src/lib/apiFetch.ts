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

export async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function apiRequest(path: string, opts?: RequestInit, options?: RelativeApiOptions): Promise<Response> {
  return fetch(createApiUrl(path, options?.basePath), { credentials: "include", ...opts });
}

export async function apiJSON<T>(path: string, opts?: RequestInit, options?: RelativeApiOptions): Promise<T> {
  const res = await apiRequest(path, opts, options);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", credentials: "include", body: form });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
