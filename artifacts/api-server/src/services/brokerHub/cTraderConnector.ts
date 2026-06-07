import type {
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerOrderResult,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
} from "./types.js";
import type { BrokerVault } from "./brokerVault.js";
import { createCTraderProvider } from "./cTraderProvider.js";

function snapshotFor(profile: BrokerAccountProfile, status: BrokerSnapshot["status"], error?: string): BrokerSnapshot {
  return {
    profileId: profile.id,
    status,
    kind: "ctrader-open-api",
    providerKind: "ctrader-open-api",
    brokerName: profile.brokerName,
    tradingEnabled: profile.tradingEnabled,
    accounts: profile.accountId
      ? [{ id: profile.accountId, label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: profile.environment }]
      : [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
    error,
  };
}

export function cTraderAuthorizationUrl(profile: BrokerAccountProfile, state: string): string | null {
  if (!profile.cTraderClientId || !profile.cTraderRedirectUri) return null;
  const url = new URL("https://id.ctrader.com/my/settings/openapi/grantingaccess/");
  url.searchParams.set("client_id", profile.cTraderClientId);
  url.searchParams.set("redirect_uri", profile.cTraderRedirectUri);
  url.searchParams.set("scope", "trading");
  url.searchParams.set("product", "web");
  url.searchParams.set("state", state);
  return url.toString();
}

export function createCTraderBrokerConnector(profile: BrokerAccountProfile, vault: BrokerVault): BrokerConnector {
  const provider = createCTraderProvider();
  const listeners = new Set<(event: BrokerEvent) => void>();
  let snapshot = snapshotFor(profile, "offline");
  let deals: BrokerDeal[] = [];

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  async function credentials(): Promise<{ accessToken: string; clientId: string; clientSecret: string }> {
    const token = await vault.getSecret(profile.id, "accessToken");
    const clientSecret = (await vault.getSecret(profile.id, "cTraderClientSecret")) ?? process.env.CTRADER_CLIENT_SECRET ?? "";
    const clientId = profile.cTraderClientId ?? process.env.CTRADER_CLIENT_ID ?? "";
    if (!token || !clientId || !clientSecret) {
      const url = cTraderAuthorizationUrl(profile, profile.id);
      throw new Error(
        url
          ? "Autorizzazione cTrader necessaria. Completa il collegamento sicuro del conto."
          : "Configurazione cTrader incompleta. Ricollega il conto o contatta supporto.",
      );
    }
    return { accessToken: token, clientId, clientSecret };
  }

  async function providerInput() {
    const auth = await credentials();
    return {
      profileId: profile.id,
      brokerName: profile.brokerName,
      accountId: profile.accountId,
      environment: profile.environment,
      tradingEnabled: profile.tradingEnabled,
      ...auth,
    };
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      try {
        const input = await providerInput();
        snapshot = await provider.snapshot(input);
        deals = await provider.history(input).catch(() => []);
      } catch (error) {
        snapshot = snapshotFor(profile, "error", error instanceof Error ? error.message : "cTrader connection failed");
      }
      emit({ type: "snapshot", snapshot });
      return snapshot;
    },
    async disconnect(): Promise<void> {
      provider.close();
      snapshot = snapshotFor(profile, "offline");
      emit({ type: "snapshot", snapshot });
    },
    async getAccounts() {
      return snapshot.accounts;
    },
    async getSnapshot() {
      if (snapshot.status === "connected") {
        try {
          snapshot = await provider.snapshot(await providerInput());
          emit({ type: "snapshot", snapshot });
        } catch {
          return snapshot;
        }
      }
      return snapshot;
    },
    async getPositions() {
      return snapshot.positions;
    },
    async getOrders() {
      return snapshot.orders;
    },
    async getDealsHistory(): Promise<BrokerDeal[]> {
      if (snapshot.status === "connected") {
        deals = await provider.history(await providerInput()).catch(() => deals);
      }
      return deals;
    },
    async placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      return provider.placeOrder({ accountId: profile.accountId, order });
    },
    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "cTrader order modification will use Open API order amendment in the next connector pass" };
    },
    async closePosition(positionId: string): Promise<BrokerOrderResult> {
      return provider.closePosition({ accountId: profile.accountId, positionId });
    },
    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
