import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BrokerAccountProfile,
  BrokerConnectionIntent,
  BrokerDeal,
  BrokerOrderDraft,
  BrokerProfileList,
  BrokerSnapshot,
} from "./types";

const EMPTY_SNAPSHOT: BrokerSnapshot = {
  profileId: "",
  status: "offline",
  kind: "demo",
  brokerName: "Broker",
  tradingEnabled: false,
  accounts: [],
  metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
  positions: [],
  orders: [],
  lastUpdated: new Date(0).toISOString(),
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

function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  return new URL(`/api${path}`, base).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Broker request failed");
  return data;
}

async function readJsonSoft<T>(response: Response): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  return { ok: response.ok, data };
}

export function useBrokerHub() {
  const [profiles, setProfiles] = useState<BrokerProfileList>({ activeProfileId: null, profiles: [] });
  const [snapshot, setSnapshot] = useState<BrokerSnapshot>(EMPTY_SNAPSHOT);
  const [history, setHistory] = useState<BrokerDeal[]>([]);
  const [connectionIntent, setConnectionIntent] = useState<BrokerConnectionIntent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await readJson<BrokerProfileList>(
        await fetch(apiUrl("/brokers/profiles"), { credentials: "include" }),
      );
      setProfiles(list);
      if (list.activeProfileId) {
        const nextSnapshot = await readJson<BrokerSnapshot>(
          await fetch(apiUrl(`/brokers/profiles/${list.activeProfileId}/snapshot`), { credentials: "include" }),
        );
        setSnapshot(nextSnapshot);
      }
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Broker Hub non disponibile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const saveProfile = useCallback(
    async (raw: Partial<BrokerAccountProfile> & { accessToken?: string; bridgeToken?: string }) => {
      const data = await readJson<{ profile: BrokerAccountProfile }>(
        await fetch(apiUrl("/brokers/profiles"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(raw),
        }),
      );
      await refreshProfiles();
      setMessage("Profilo broker salvato");
      return data.profile;
    },
    [refreshProfiles],
  );

  const createConnectionIntent = useCallback(async (brokerName = "FP Trading") => {
    const data = await readJson<{ intent: BrokerConnectionIntent }>(
      await fetch(apiUrl("/brokers/connect-intents"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brokerName }),
      }),
    );
    setConnectionIntent(data.intent);
    setMessage(data.intent.displayStatus);
    return data.intent;
  }, []);

  const verifyConnectionIntent = useCallback(async (intentId: string) => {
    const data = await readJson<{ intent: BrokerConnectionIntent; snapshot?: BrokerSnapshot }>(
      await fetch(apiUrl(`/brokers/connect-intents/${intentId}/verify`), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    setConnectionIntent(data.intent);
    setMessage(data.intent.displayStatus);
    return data.intent;
  }, []);

  const verifyAccountCredentials = useCallback(
    async (
      intentId: string,
      payload: { accountNumber: string; accountPassword: string; server?: string; tradingEnabled?: boolean },
    ) => {
      const result = await readJsonSoft<{ intent?: BrokerConnectionIntent; snapshot?: BrokerSnapshot }>(
        await fetch(apiUrl(`/brokers/connect-intents/${intentId}/verify`), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      const data = result.data;
      if (data.intent) setConnectionIntent(data.intent);
      if (data.snapshot) setSnapshot(data.snapshot);
      setMessage(data.intent?.displayStatus ?? data.error ?? "Conto non verificato");
      if (!result.ok) return { intent: data.intent, snapshot: data.snapshot };
      return data;
    },
    [],
  );

  const completeConnectionIntent = useCallback(
    async (
      intentId: string,
      payload: {
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
      },
    ) => {
      const result = await readJsonSoft<{
        intent?: BrokerConnectionIntent;
        profile?: BrokerAccountProfile;
        snapshot?: BrokerSnapshot;
      }>(
        await fetch(apiUrl(`/brokers/connect-intents/${intentId}/complete`), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      const data = result.data;
      if (data.intent) setConnectionIntent(data.intent);
      if (data.snapshot) setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(data.intent?.displayStatus ?? data.error ?? "Conto non collegato");
      return data;
    },
    [refreshProfiles],
  );

  const createCompanionPairing = useCallback(
    async (payload: { brokerName: string; tradingEnabled?: boolean }) => {
      const data = await readJson<{
        profile: BrokerAccountProfile;
        pairing: { token: string; expiresAt: string; instructions: string[] };
      }>(
        await fetch(apiUrl("/brokers/companion/pairing"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      await refreshProfiles();
      setMessage("Pairing Connector pronto");
      return data;
    },
    [refreshProfiles],
  );

  const startMt5SmartLink = useCallback(
    async (payload: { brokerName: string; tradingEnabled?: boolean; profileId?: string }) => {
      const data = await readJson<{ profile: BrokerAccountProfile; status: Mt5SmartLinkStatus; snapshot: BrokerSnapshot }>(
        await fetch(apiUrl("/brokers/smartlink/mt5/start"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const getMt5SmartLinkStatus = useCallback(async (profileId: string) => {
    return readJson<Mt5SmartLinkStatus>(
      await fetch(apiUrl(`/brokers/smartlink/mt5/status?profileId=${encodeURIComponent(profileId)}`), { credentials: "include" }),
    );
  }, []);

  const loginMt5SmartLink = useCallback(
    async (payload: { profileId: string; accountNumber: string; password: string; server: string }) => {
      const data = await readJson<{ profile: BrokerAccountProfile; status: Mt5SmartLinkStatus }>(
        await fetch(apiUrl("/brokers/smartlink/mt5/login"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const stopMt5SmartLink = useCallback(
    async (profileId: string) => {
      const data = await readJson<{ profile: BrokerAccountProfile; status: Mt5SmartLinkStatus }>(
        await fetch(apiUrl("/brokers/smartlink/mt5/stop"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profileId }),
        }),
      );
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const getMt5SmartLinkDiagnostics = useCallback(async (profileId: string) => {
    return readJson<{ profileId: string; checks: Mt5SmartLinkDiagnosticCheck[] }>(
      await fetch(apiUrl(`/brokers/smartlink/mt5/diagnostics?profileId=${encodeURIComponent(profileId)}`), { credentials: "include" }),
    );
  }, []);

  const getCompanionStatus = useCallback(async (profileId: string) => {
    return readJson<{ profileId: string; health: string; connected: boolean; hasSnapshot: boolean; lastUpdated?: string; message: string }>(
      await fetch(apiUrl(`/brokers/companion/status/${encodeURIComponent(profileId)}`), { credentials: "include" }),
    );
  }, []);

  const importBrokerHistory = useCallback(
    async (payload: {
      brokerName: string;
      accountLabel?: string;
      accountId?: string;
      deals: Array<{ id?: string; symbol: string; side: "buy" | "sell"; volume: number; profit?: number }>;
    }) => {
      const data = await readJson<{ profile: BrokerAccountProfile; snapshot: BrokerSnapshot; imported: number }>(
        await fetch(apiUrl("/brokers/import/history"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(`${data.imported} trade importati`);
      return data;
    },
    [refreshProfiles],
  );

  const connectProfile = useCallback(
    async (id: string) => {
      const result = await readJsonSoft<{ profile?: BrokerAccountProfile; snapshot?: BrokerSnapshot }>(
        await fetch(apiUrl(`/brokers/profiles/${id}/connect`), { method: "POST", credentials: "include" }),
      );
      const data = result.data;
      if (data.snapshot) setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(
        data.snapshot?.status === "connected"
          ? "Broker collegato"
          : data.snapshot?.error ?? data.error ?? "Broker non collegato",
      );
    },
    [refreshProfiles],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      const response = await fetch(apiUrl(`/brokers/profiles/${id}`), { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Impossibile eliminare il profilo broker");
      await refreshProfiles();
      setMessage("Profilo broker eliminato");
    },
    [refreshProfiles],
  );

  const placeOrder = useCallback(
    async (profileId: string, order: BrokerOrderDraft) => {
      const response = await readJsonSoft<{ accepted?: boolean; reason?: string; orderId?: string }>(
        await fetch(apiUrl(`/brokers/profiles/${profileId}/orders`), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(order),
        }),
      );
      const result = response.data;
      setMessage(result.accepted ? `Ordine inviato ${result.orderId ?? ""}`.trim() : result.reason ?? "Ordine rifiutato");
      const nextSnapshot = await readJson<BrokerSnapshot>(
        await fetch(apiUrl(`/brokers/profiles/${profileId}/snapshot`), { credentials: "include" }),
      );
      setSnapshot(nextSnapshot);
      return result;
    },
    [],
  );

  const closePosition = useCallback(async (profileId: string, positionId: string) => {
    const response = await readJsonSoft<{ accepted?: boolean; reason?: string; orderId?: string }>(
      await fetch(apiUrl(`/brokers/profiles/${profileId}/positions/${encodeURIComponent(positionId)}/close`), {
        method: "POST",
        credentials: "include",
      }),
    );
    const result = response.data;
    setMessage(result.accepted ? `Chiusura inviata ${result.orderId ?? ""}`.trim() : result.reason ?? "Chiusura rifiutata");
    const nextSnapshot = await readJson<BrokerSnapshot>(
      await fetch(apiUrl(`/brokers/profiles/${profileId}/snapshot`), { credentials: "include" }),
    );
    setSnapshot(nextSnapshot);
    return result;
  }, []);

  const refreshHistory = useCallback(async (profileId: string) => {
    const data = await readJson<BrokerDeal[]>(
      await fetch(apiUrl(`/brokers/profiles/${profileId}/history`), { credentials: "include" }),
    );
    setHistory(data);
  }, []);

  const companionDownloadUrls = useCallback((profileId: string, token: string, tradingEnabled: boolean) => {
    const settings = new URLSearchParams({
      profileId,
      token,
      tradingEnabled: tradingEnabled ? "true" : "false",
    });
    return {
      mt5Connector: apiUrl("/brokers/companion/downloads/mt5-ea"),
      mt5Settings: apiUrl(`/brokers/companion/downloads/mt5-settings?${settings.toString()}`),
    };
  }, []);

  return useMemo(
    () => ({
      profiles,
      activeProfile: profiles.profiles.find((profile) => profile.id === profiles.activeProfileId) ?? null,
      snapshot,
      history,
      connectionIntent,
      loading,
      message,
      refreshProfiles,
      saveProfile,
      createConnectionIntent,
      verifyConnectionIntent,
      verifyAccountCredentials,
      completeConnectionIntent,
      createCompanionPairing,
      startMt5SmartLink,
      getMt5SmartLinkStatus,
      loginMt5SmartLink,
      stopMt5SmartLink,
      getMt5SmartLinkDiagnostics,
      getCompanionStatus,
      importBrokerHistory,
      connectProfile,
      deleteProfile,
      placeOrder,
      closePosition,
      refreshHistory,
      companionDownloadUrls,
    }),
    [
      profiles,
      snapshot,
      history,
      connectionIntent,
      loading,
      message,
      refreshProfiles,
      saveProfile,
      createConnectionIntent,
      verifyConnectionIntent,
      verifyAccountCredentials,
      completeConnectionIntent,
      createCompanionPairing,
      startMt5SmartLink,
      getMt5SmartLinkStatus,
      loginMt5SmartLink,
      stopMt5SmartLink,
      getMt5SmartLinkDiagnostics,
      getCompanionStatus,
      importBrokerHistory,
      connectProfile,
      deleteProfile,
      placeOrder,
      closePosition,
      refreshHistory,
      companionDownloadUrls,
    ],
  );
}
