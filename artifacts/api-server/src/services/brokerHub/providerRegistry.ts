import type {
  BrokerCapabilities,
  BrokerProviderKind,
  BrokerSnapshot,
} from "./types.js";
import { createMetaApiProvider } from "./metaApiProvider.js";
import { createSnapTradeProvider } from "./snapTradeProvider.js";

export interface BrokerAccountCredentials {
  brokerName: string;
  accountNumber: string;
  accountPassword: string;
  server?: string;
  tradingEnabled: boolean;
}

export interface BrokerProviderVerification {
  providerKind: BrokerProviderKind;
  providerUserId?: string;
  providerAccountId: string;
  accountId: string;
  label: string;
  connectionStatus: BrokerSnapshot["status"];
  userDisplayStatus: string;
  capabilities: BrokerCapabilities;
  snapshot: BrokerSnapshot;
}

export interface BrokerAuthorizationStart {
  providerKind: BrokerProviderKind;
  providerUserId: string;
  authorizationUrl: string;
  sessionId: string;
  userSecret: string;
  displayStatus: string;
}

export interface BrokerAuthorizationCompleteInput {
  providerKind: BrokerProviderKind;
  providerUserId: string;
  userSecret: string;
  brokerName: string;
  tradingEnabled: boolean;
}

export interface BrokerProviderRegistry {
  verifyAccount(input: BrokerAccountCredentials): Promise<BrokerProviderVerification>;
  startAuthorization?(input: { brokerName: string; tradingEnabled: boolean; customRedirect?: string }): Promise<BrokerAuthorizationStart>;
  completeAuthorization?(input: BrokerAuthorizationCompleteInput): Promise<BrokerProviderVerification & { userSecret?: string }>;
}

function requireCredentials(input: BrokerAccountCredentials): void {
  if (!input.accountNumber.trim()) throw new Error("Inserisci il numero conto fornito dal broker.");
  if (!input.accountPassword) throw new Error("Inserisci la password del conto fornita dal broker.");
}

export function createDefaultBrokerProviderRegistry(): BrokerProviderRegistry {
  const metaApiProvider = createMetaApiProvider();
  const snapTradeProvider = createSnapTradeProvider();
  return {
    async verifyAccount(input: BrokerAccountCredentials): Promise<BrokerProviderVerification> {
      requireCredentials(input);
      return metaApiProvider.verifyAccount(input);
    },
    async startAuthorization(input) {
      const userId = `snaptrade-${crypto.randomUUID()}`;
      const portal = await snapTradeProvider.createConnectionPortal({
        userId,
        connectionType: input.tradingEnabled ? "trade-if-available" : "read",
        customRedirect: input.customRedirect,
      });
      return {
        providerKind: "snaptrade-brokerage",
        providerUserId: portal.userId,
        authorizationUrl: portal.redirectURI,
        sessionId: portal.sessionId,
        userSecret: portal.userSecret,
        displayStatus: "Apri il portale sicuro e collega il conto broker.",
      };
    },
    async completeAuthorization(input) {
      if (input.providerKind !== "snaptrade-brokerage") throw new Error("Provider di autorizzazione non supportato.");
      return snapTradeProvider.completeAuthorization({
        userId: input.providerUserId,
        userSecret: input.userSecret,
        brokerName: input.brokerName,
        profileId: "pending",
        tradingEnabled: input.tradingEnabled,
      });
    },
  };
}

export function createStaticBrokerProviderRegistry(result: BrokerProviderVerification): BrokerProviderRegistry {
  return {
    async verifyAccount(input: BrokerAccountCredentials): Promise<BrokerProviderVerification> {
      requireCredentials(input);
      return {
        ...result,
        accountId: input.accountNumber,
        label: result.label || `${input.brokerName} ${input.accountNumber}`,
        snapshot: {
          ...result.snapshot,
          brokerName: input.brokerName,
          tradingEnabled: input.tradingEnabled,
          accounts: result.snapshot.accounts.length
            ? result.snapshot.accounts
            : [
                {
                  id: input.accountNumber,
                  label: `${input.brokerName} ${input.accountNumber}`,
                  brokerName: input.brokerName,
                  currency: "USD",
                  environment: "live",
                },
              ],
        },
      };
    },
  };
}
