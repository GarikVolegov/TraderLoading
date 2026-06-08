import type {
  BrokerAccountProfile,
  BrokerConnectionIntent,
  BrokerDeal,
  BrokerOrderDraft,
  BrokerProfileList,
  BrokerSnapshot,
} from "./types";

export type BrokerHubApiOptions = {
  baseUrl?: string;
};

export type BrokerProfileDraft = Partial<BrokerAccountProfile> & {
  accessToken?: string;
  bridgeToken?: string;
};

export type BrokerConnectionCredentialsPayload = {
  accountNumber: string;
  accountPassword: string;
  server?: string;
  tradingEnabled?: boolean;
};

export type BrokerConnectionCompletePayload = {
  mode?: "demo" | "advanced" | "credentials" | "verified" | "authorization";
  platform?: "api" | "mt5-vps";
  accountNumber?: string;
  accountPassword?: string;
  server?: string;
  accountLabel?: string;
  accountId?: string;
  host?: string;
  port?: number;
  bridgeToken?: string;
  clientId?: string;
  redirectUri?: string;
  accessToken?: string;
  tradingEnabled?: boolean;
};

export type BrokerConnectionIntentResponse = {
  intent: BrokerConnectionIntent;
  snapshot?: BrokerSnapshot;
};

export type BrokerConnectionSoftResponse = {
  intent?: BrokerConnectionIntent;
  profile?: BrokerAccountProfile;
  snapshot?: BrokerSnapshot;
};

export type CompanionPairingPayload = {
  brokerName: string;
  tradingEnabled?: boolean;
};

export type CompanionPairingResponse = {
  profile: BrokerAccountProfile;
  pairing: { token: string; expiresAt: string; instructions: string[] };
};

export interface Mt5SmartLinkStatus {
  profileId: string;
  status: "starting" | "waiting_for_terminal" | "waiting_for_login" | "waiting_for_snapshot" | "connected" | "stopped" | "error";
  connected: boolean;
  terminalDetected: boolean;
  terminalPath?: string;
  message: string;
}

export interface Mt5SmartLinkDiagnosticCheck {
  id: string;
  label: string;
  ok: boolean;
  message: string;
}

export type Mt5SmartLinkStartPayload = {
  brokerName: string;
  tradingEnabled?: boolean;
  profileId?: string;
};

export type Mt5SmartLinkLoginPayload = {
  profileId: string;
  accountNumber: string;
  password: string;
  server: string;
};

export type Mt5SmartLinkProfileResponse = {
  profile: BrokerAccountProfile;
  status: Mt5SmartLinkStatus;
};

export type Mt5SmartLinkStartResponse = Mt5SmartLinkProfileResponse & {
  snapshot: BrokerSnapshot;
};

export type Mt5SmartLinkDiagnosticsResponse = {
  profileId: string;
  checks: Mt5SmartLinkDiagnosticCheck[];
};

export type CompanionStatusResponse = {
  profileId: string;
  health: string;
  connected: boolean;
  hasSnapshot: boolean;
  lastUpdated?: string;
  message: string;
};

export type BrokerHistoryImportPayload = {
  brokerName: string;
  accountLabel?: string;
  accountId?: string;
  deals: Array<{ id?: string; symbol: string; side: "buy" | "sell"; volume: number; profit?: number }>;
};

export type BrokerHistoryImportResponse = {
  profile: BrokerAccountProfile;
  snapshot: BrokerSnapshot;
  imported: number;
};

export type BrokerProfileConnectResponse = {
  profile?: BrokerAccountProfile;
  snapshot?: BrokerSnapshot;
};

export type BrokerOrderResult = {
  accepted?: boolean;
  reason?: string;
  orderId?: string;
};

function defaultBrokerApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  if (configured && configured.trim()) return configured;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function createBrokerHubUrl(path: string, options: BrokerHubApiOptions = {}): string {
  const base = options.baseUrl ?? defaultBrokerApiBase();
  return new URL(`/api${path}`, base).toString();
}

async function readJson<T>(response: Response, fallbackMessage = "Broker request failed"): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? fallbackMessage);
  return data;
}

async function readJsonSoft<T>(response: Response): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  return { ok: response.ok, data };
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function listBrokerProfiles(options?: BrokerHubApiOptions): Promise<BrokerProfileList> {
  return readJson<BrokerProfileList>(
    await fetch(createBrokerHubUrl("/brokers/profiles", options), { credentials: "include" }),
  );
}

export async function getBrokerSnapshot(profileId: string, options?: BrokerHubApiOptions): Promise<BrokerSnapshot> {
  return readJson<BrokerSnapshot>(
    await fetch(createBrokerHubUrl(`/brokers/profiles/${encodeURIComponent(profileId)}/snapshot`, options), {
      credentials: "include",
    }),
  );
}

export async function saveBrokerProfile(
  draft: BrokerProfileDraft,
  options?: BrokerHubApiOptions,
): Promise<{ profile: BrokerAccountProfile }> {
  return readJson<{ profile: BrokerAccountProfile }>(
    await fetch(createBrokerHubUrl("/brokers/profiles", options), jsonPost(draft)),
  );
}

export async function deleteBrokerProfile(profileId: string, options?: BrokerHubApiOptions): Promise<void> {
  const response = await fetch(createBrokerHubUrl(`/brokers/profiles/${encodeURIComponent(profileId)}`, options), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Impossibile eliminare il profilo broker");
  }
}

export async function createBrokerConnectionIntent(
  brokerName = "FP Trading",
  options?: BrokerHubApiOptions,
): Promise<{ intent: BrokerConnectionIntent }> {
  return readJson<{ intent: BrokerConnectionIntent }>(
    await fetch(createBrokerHubUrl("/brokers/connect-intents", options), jsonPost({ brokerName })),
  );
}

export async function verifyBrokerConnectionIntent(
  intentId: string,
  payload: BrokerConnectionCredentialsPayload | Record<string, never> = {},
  options?: BrokerHubApiOptions,
): Promise<BrokerConnectionIntentResponse> {
  return readJson<BrokerConnectionIntentResponse>(
    await fetch(createBrokerHubUrl(`/brokers/connect-intents/${encodeURIComponent(intentId)}/verify`, options), jsonPost(payload)),
  );
}

export async function verifyBrokerConnectionIntentSoft(
  intentId: string,
  payload: BrokerConnectionCredentialsPayload,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerConnectionSoftResponse & { error?: string } }> {
  return readJsonSoft<BrokerConnectionSoftResponse>(
    await fetch(createBrokerHubUrl(`/brokers/connect-intents/${encodeURIComponent(intentId)}/verify`, options), jsonPost(payload)),
  );
}

export async function completeBrokerConnectionIntent(
  intentId: string,
  payload: BrokerConnectionCompletePayload,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerConnectionSoftResponse & { error?: string } }> {
  return readJsonSoft<BrokerConnectionSoftResponse>(
    await fetch(createBrokerHubUrl(`/brokers/connect-intents/${encodeURIComponent(intentId)}/complete`, options), jsonPost(payload)),
  );
}

export async function createCompanionPairing(
  payload: CompanionPairingPayload,
  options?: BrokerHubApiOptions,
): Promise<CompanionPairingResponse> {
  return readJson<CompanionPairingResponse>(
    await fetch(createBrokerHubUrl("/brokers/companion/pairing", options), jsonPost(payload)),
  );
}

export async function startMt5SmartLink(
  payload: Mt5SmartLinkStartPayload,
  options?: BrokerHubApiOptions,
): Promise<Mt5SmartLinkStartResponse> {
  return readJson<Mt5SmartLinkStartResponse>(
    await fetch(createBrokerHubUrl("/brokers/smartlink/mt5/start", options), jsonPost(payload)),
  );
}

export async function getMt5SmartLinkStatus(
  profileId: string,
  options?: BrokerHubApiOptions,
): Promise<Mt5SmartLinkStatus> {
  return readJson<Mt5SmartLinkStatus>(
    await fetch(createBrokerHubUrl(`/brokers/smartlink/mt5/status?profileId=${encodeURIComponent(profileId)}`, options), {
      credentials: "include",
    }),
  );
}

export async function loginMt5SmartLink(
  payload: Mt5SmartLinkLoginPayload,
  options?: BrokerHubApiOptions,
): Promise<Mt5SmartLinkProfileResponse> {
  return readJson<Mt5SmartLinkProfileResponse>(
    await fetch(createBrokerHubUrl("/brokers/smartlink/mt5/login", options), jsonPost(payload)),
  );
}

export async function stopMt5SmartLink(
  profileId: string,
  options?: BrokerHubApiOptions,
): Promise<Mt5SmartLinkProfileResponse> {
  return readJson<Mt5SmartLinkProfileResponse>(
    await fetch(createBrokerHubUrl("/brokers/smartlink/mt5/stop", options), jsonPost({ profileId })),
  );
}

export async function getMt5SmartLinkDiagnostics(
  profileId: string,
  options?: BrokerHubApiOptions,
): Promise<Mt5SmartLinkDiagnosticsResponse> {
  return readJson<Mt5SmartLinkDiagnosticsResponse>(
    await fetch(createBrokerHubUrl(`/brokers/smartlink/mt5/diagnostics?profileId=${encodeURIComponent(profileId)}`, options), {
      credentials: "include",
    }),
  );
}

export async function getCompanionStatus(
  profileId: string,
  options?: BrokerHubApiOptions,
): Promise<CompanionStatusResponse> {
  return readJson<CompanionStatusResponse>(
    await fetch(createBrokerHubUrl(`/brokers/companion/status/${encodeURIComponent(profileId)}`, options), {
      credentials: "include",
    }),
  );
}

export async function importBrokerHistory(
  payload: BrokerHistoryImportPayload,
  options?: BrokerHubApiOptions,
): Promise<BrokerHistoryImportResponse> {
  return readJson<BrokerHistoryImportResponse>(
    await fetch(createBrokerHubUrl("/brokers/import/history", options), jsonPost(payload)),
  );
}

export async function connectBrokerProfile(
  profileId: string,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerProfileConnectResponse & { error?: string } }> {
  return readJsonSoft<BrokerProfileConnectResponse>(
    await fetch(createBrokerHubUrl(`/brokers/profiles/${encodeURIComponent(profileId)}/connect`, options), {
      method: "POST",
      credentials: "include",
    }),
  );
}

export async function placeBrokerOrder(
  profileId: string,
  order: BrokerOrderDraft,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerOrderResult & { error?: string } }> {
  return readJsonSoft<BrokerOrderResult>(
    await fetch(createBrokerHubUrl(`/brokers/profiles/${encodeURIComponent(profileId)}/orders`, options), jsonPost(order)),
  );
}

export async function closeBrokerPosition(
  profileId: string,
  positionId: string,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerOrderResult & { error?: string } }> {
  return readJsonSoft<BrokerOrderResult>(
    await fetch(
      createBrokerHubUrl(
        `/brokers/profiles/${encodeURIComponent(profileId)}/positions/${encodeURIComponent(positionId)}/close`,
        options,
      ),
      { method: "POST", credentials: "include" },
    ),
  );
}

export async function getBrokerHistory(profileId: string, options?: BrokerHubApiOptions): Promise<BrokerDeal[]> {
  return readJson<BrokerDeal[]>(
    await fetch(createBrokerHubUrl(`/brokers/profiles/${encodeURIComponent(profileId)}/history`, options), {
      credentials: "include",
    }),
  );
}
