import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BrokerAccountProfile,
  BrokerConnectionIntent,
  BrokerDeal,
  BrokerOrderDraft,
  BrokerProfileList,
  BrokerSnapshot,
} from "./types";
import {
  closeBrokerPosition as closeBrokerPositionRequest,
  completeBrokerConnectionIntent,
  connectBrokerProfile as connectBrokerProfileRequest,
  createCompanionPairing as createCompanionPairingRequest,
  createBrokerHubUrl,
  createBrokerConnectionIntent,
  deleteBrokerProfile,
  getCompanionStatus as fetchCompanionStatus,
  getBrokerHistory,
  getBrokerSnapshot,
  getMt5SmartLinkDiagnostics as fetchMt5SmartLinkDiagnostics,
  getMt5SmartLinkStatus as fetchMt5SmartLinkStatus,
  importBrokerHistory as importBrokerHistoryRequest,
  listBrokerProfiles,
  loginMt5SmartLink as loginMt5SmartLinkRequest,
  placeBrokerOrder,
  saveBrokerProfile,
  startMt5SmartLink as startMt5SmartLinkRequest,
  stopMt5SmartLink as stopMt5SmartLinkRequest,
  type BrokerHistoryImportPayload,
  verifyBrokerConnectionIntent,
  verifyBrokerConnectionIntentSoft,
  type BrokerConnectionCompletePayload,
  type BrokerConnectionCredentialsPayload,
  type CompanionPairingPayload,
  type Mt5SmartLinkLoginPayload,
  type Mt5SmartLinkStartPayload,
} from "./brokerHubApi";

export type { Mt5SmartLinkDiagnosticCheck, Mt5SmartLinkStatus } from "./brokerHubApi";

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

const apiUrl = createBrokerHubUrl;

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
      const list = await listBrokerProfiles();
      setProfiles(list);
      if (list.activeProfileId) {
        const nextSnapshot = await getBrokerSnapshot(list.activeProfileId);
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
      const data = await saveBrokerProfile(raw);
      await refreshProfiles();
      setMessage("Profilo broker salvato");
      return data.profile;
    },
    [refreshProfiles],
  );

  const createConnectionIntent = useCallback(async (brokerName = "FP Trading") => {
    const data = await createBrokerConnectionIntent(brokerName);
    setConnectionIntent(data.intent);
    setMessage(data.intent.displayStatus);
    return data.intent;
  }, []);

  const verifyConnectionIntent = useCallback(async (intentId: string) => {
    const data = await verifyBrokerConnectionIntent(intentId);
    setConnectionIntent(data.intent);
    setMessage(data.intent.displayStatus);
    return data.intent;
  }, []);

  const verifyAccountCredentials = useCallback(
    async (
      intentId: string,
      payload: BrokerConnectionCredentialsPayload,
    ) => {
      const result = await verifyBrokerConnectionIntentSoft(intentId, payload);
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
      payload: BrokerConnectionCompletePayload,
    ) => {
      const result = await completeBrokerConnectionIntent(intentId, payload);
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
    async (payload: CompanionPairingPayload) => {
      const data = await createCompanionPairingRequest(payload);
      await refreshProfiles();
      setMessage("Pairing Connector pronto");
      return data;
    },
    [refreshProfiles],
  );

  const startMt5SmartLink = useCallback(
    async (payload: Mt5SmartLinkStartPayload) => {
      const data = await startMt5SmartLinkRequest(payload);
      setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const getMt5SmartLinkStatus = useCallback(async (profileId: string) => {
    return fetchMt5SmartLinkStatus(profileId);
  }, []);

  const loginMt5SmartLink = useCallback(
    async (payload: Mt5SmartLinkLoginPayload) => {
      const data = await loginMt5SmartLinkRequest(payload);
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const stopMt5SmartLink = useCallback(
    async (profileId: string) => {
      const data = await stopMt5SmartLinkRequest(profileId);
      await refreshProfiles();
      setMessage(data.status.message);
      return data;
    },
    [refreshProfiles],
  );

  const getMt5SmartLinkDiagnostics = useCallback(async (profileId: string) => {
    return fetchMt5SmartLinkDiagnostics(profileId);
  }, []);

  const getCompanionStatus = useCallback(async (profileId: string) => {
    return fetchCompanionStatus(profileId);
  }, []);

  const importBrokerHistory = useCallback(
    async (payload: BrokerHistoryImportPayload) => {
      const data = await importBrokerHistoryRequest(payload);
      setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(`${data.imported} trade importati`);
      return data;
    },
    [refreshProfiles],
  );

  const connectProfile = useCallback(
    async (id: string) => {
      const result = await connectBrokerProfileRequest(id);
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
      await deleteBrokerProfile(id);
      await refreshProfiles();
      setMessage("Profilo broker eliminato");
    },
    [refreshProfiles],
  );

  const placeOrder = useCallback(
    async (profileId: string, order: BrokerOrderDraft) => {
      const response = await placeBrokerOrder(profileId, order);
      const result = response.data;
      setMessage(result.accepted ? `Ordine inviato ${result.orderId ?? ""}`.trim() : result.reason ?? "Ordine rifiutato");
      const nextSnapshot = await getBrokerSnapshot(profileId);
      setSnapshot(nextSnapshot);
      return result;
    },
    [],
  );

  const closePosition = useCallback(async (profileId: string, positionId: string) => {
    const response = await closeBrokerPositionRequest(profileId, positionId);
    const result = response.data;
    setMessage(result.accepted ? `Chiusura inviata ${result.orderId ?? ""}`.trim() : result.reason ?? "Chiusura rifiutata");
    const nextSnapshot = await getBrokerSnapshot(profileId);
    setSnapshot(nextSnapshot);
    return result;
  }, []);

  const refreshHistory = useCallback(async (profileId: string) => {
    const data = await getBrokerHistory(profileId);
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
