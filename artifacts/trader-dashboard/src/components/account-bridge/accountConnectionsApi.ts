import type { AccountConnectionList, AccountConnectionProfile } from "./types";

export type AccountConnectionsApiOptions = {
  baseUrl?: string;
};

export type AccountConnectionDraft = Partial<
  Pick<
    AccountConnectionProfile,
    | "id"
    | "label"
    | "adapter"
    | "mode"
    | "host"
    | "port"
    | "terminalPath"
    | "importJournal"
    | "orderEnabled"
    | "orderAckTimeoutMs"
  >
>;

export type AccountConnectionTestResult = {
  reachable: boolean;
  message: string;
};

function defaultAccountApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  if (configured && configured.trim()) return configured;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function createAccountConnectionUrl(path: string, options: AccountConnectionsApiOptions = {}): string {
  const base = options.baseUrl ?? defaultAccountApiBase();
  return new URL(`/api${path}`, base).toString();
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? fallbackMessage);
  return data;
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function listAccountConnections(options?: AccountConnectionsApiOptions): Promise<AccountConnectionList> {
  return readJson<AccountConnectionList>(
    await fetch(createAccountConnectionUrl("/account/connections", options), { credentials: "include" }),
    "Account connection request failed",
  );
}

export async function createAccountConnection(
  draft: AccountConnectionDraft,
  options?: AccountConnectionsApiOptions,
): Promise<{ profile: AccountConnectionProfile; activeProfileId: string | null }> {
  return readJson<{ profile: AccountConnectionProfile; activeProfileId: string | null }>(
    await fetch(createAccountConnectionUrl("/account/connections", options), jsonRequest(draft)),
    "Account connection request failed",
  );
}

export async function activateAccountConnection(
  id: string,
  options?: AccountConnectionsApiOptions,
): Promise<{ activeProfileId: string; profile: AccountConnectionProfile; snapshot: unknown }> {
  return readJson<{ activeProfileId: string; profile: AccountConnectionProfile; snapshot: unknown }>(
    await fetch(createAccountConnectionUrl(`/account/connections/${id}/activate`, options), {
      method: "POST",
      credentials: "include",
    }),
    "Account connection request failed",
  );
}

export async function deleteAccountConnection(id: string, options?: AccountConnectionsApiOptions): Promise<void> {
  const response = await fetch(createAccountConnectionUrl(`/account/connections/${id}`, options), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Impossibile eliminare il profilo");
  }
}

export async function testAccountConnection(id: string, options?: AccountConnectionsApiOptions): Promise<AccountConnectionTestResult> {
  return readJson<AccountConnectionTestResult>(
    await fetch(createAccountConnectionUrl(`/account/connections/${id}/test`, options), {
      method: "POST",
      credentials: "include",
    }),
    "Account connection request failed",
  );
}
