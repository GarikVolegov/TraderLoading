import { Router, type IRouter, type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { brokerHubRuntime, type BrokerHubRuntime } from "../services/brokerHub/runtime.js";
import {
  createConnectionIntentStore,
  publicIntent,
  type ConnectionIntentStore,
} from "../services/brokerHub/connectionIntentStore.js";
import { BROKER_CATALOG, resolveBroker } from "../services/brokerHub/brokerCatalog.js";
import { companionStore as defaultCompanionStore, type CompanionStore } from "../services/brokerHub/companionStore.js";
import { mt5SmartLinkService as defaultMt5SmartLinkService, type Mt5SmartLinkService } from "../services/brokerHub/mt5SmartLinkService.js";
import {
  createDefaultBrokerProviderRegistry,
  type BrokerProviderRegistry,
} from "../services/brokerHub/providerRegistry.js";
import { parseFxBlueProfileRef } from "../services/brokerHub/fxBlueConnector.js";
import {
  createFxBlueSetupIntentStore,
  type FxBlueSetupIntentStore,
} from "../services/brokerHub/fxBlueSetupIntentStore.js";
import type {
  BrokerAccount,
  BrokerCapabilities,
  BrokerDeal,
  BrokerOrder,
  BrokerPosition,
  BrokerSnapshot,
  ConnectorRoute,
} from "../services/brokerHub/types.js";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Broker request failed";
}

function getUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

async function claimBrokerProfileForCurrentUser(
  runtime: BrokerHubRuntime,
  req: Request,
  profileId: string,
): Promise<void> {
  const userId = getUserId(req);
  if (!userId) return;
  const profiles = await runtime.listProfiles();
  const profile = profiles.profiles.find((item) => item.id === profileId);
  if (!profile || profile.ownerUserId === userId || profile.ownerUserId) return;
  await runtime.saveProfile({ id: profile.id, ownerUserId: userId });
}

interface BrokersRouterOptions {
  intentStore?: ConnectionIntentStore;
  providerRegistry?: BrokerProviderRegistry;
  companionStore?: CompanionStore;
  smartLinkService?: Mt5SmartLinkService;
  fxBlueSetupIntentStore?: FxBlueSetupIntentStore;
  enableLegacyConnectionRoutes?: boolean;
}

const FXBLUE_ONLY_CONNECTION_ERROR = "Il Broker Hub collega nuovi conti solo tramite FX Blue Account Sync.";

const FXBLUE_ONLY_CATALOG = [
  {
    id: "fxblue-account-sync",
    displayName: "FX Blue Account Sync",
    defaultAccountLabel: "FX Blue Account Sync",
    category: "metatrader",
    primaryProviderKind: "fxblue-account-sync",
    recommendedRoute: "fxblue_account_sync",
    availableRoutes: ["fxblue_account_sync"],
    userFields: ["platform", "brokerName", "server", "accountNumber", "environment", "investorPassword"],
  },
];

function blockLegacyConnectionRoute(_req: Request, res: Response): void {
  res.status(410).json({ error: FXBLUE_ONLY_CONNECTION_ERROR });
}

function numberFrom(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function localCompanionCapabilities(tradingEnabled: boolean): BrokerCapabilities {
  return {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: tradingEnabled,
    closePositions: tradingEnabled,
    realtimeUpdates: true,
    requiresTerminal: true,
  };
}

function mt5SmartLinkCapabilities(tradingEnabled: boolean): BrokerCapabilities {
  return {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: tradingEnabled,
    closePositions: tradingEnabled,
    realtimeUpdates: true,
    requiresTerminal: true,
  };
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function appBaseUrl(value: unknown): string {
  const candidate = readString(value);
  if (!candidate) return "http://127.0.0.1:3001/api/brokers";
  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://127.0.0.1:3001/api/brokers";
  }
}

async function readMt5ConnectorSource(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), "tools", "metatrader-companion", "TraderLoadingConnector.mq5"),
    resolve(process.cwd(), "..", "..", "tools", "metatrader-companion", "TraderLoadingConnector.mq5"),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // Try the next workspace/package-relative location.
    }
  }
  throw new Error("TraderLoadingConnector.mq5 non trovato.");
}

function readSide(value: unknown): "buy" | "sell" {
  return String(value).toLowerCase() === "sell" ? "sell" : "buy";
}

function readOrderType(value: unknown): "market" | "limit" | "stop" {
  const type = String(value).toLowerCase();
  return type === "limit" || type === "stop" ? type : "market";
}

function readBrokerSource(value: unknown): BrokerDeal["source"] {
  if (value === "fxblue-account-sync") return "fxblue-account-sync";
  return value === "traderloading-mt5-smartlink" ? "traderloading-mt5-smartlink" : "metatrader-local-companion";
}

function normalizeAccount(value: unknown, brokerName: string): BrokerAccount {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const id = readString(data.id, readString(data.login, "UNKNOWN"));
  return {
    id,
    label: readString(data.label, `${brokerName} ${id}`.trim()),
    brokerName: readString(data.brokerName, brokerName),
    currency: readString(data.currency, "USD"),
    environment: data.environment === "demo" ? "demo" : "live",
  };
}

function normalizePosition(value: unknown): BrokerPosition {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const brokerPositionId = readString(data.brokerPositionId, readString(data.id, crypto.randomUUID()));
  return {
    id: readString(data.id, brokerPositionId),
    brokerPositionId,
    symbol: readString(data.symbol).toUpperCase(),
    side: readSide(data.side),
    volume: readNumber(data.volume),
    entryPrice: typeof data.entryPrice === "number" ? data.entryPrice : undefined,
    markPrice: typeof data.markPrice === "number" ? data.markPrice : undefined,
    profit: typeof data.profit === "number" ? data.profit : undefined,
    openedAt: readString(data.openedAt) || undefined,
    source: readBrokerSource(data.source),
  };
}

function normalizeOrder(value: unknown): BrokerOrder {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const id = readString(data.id, crypto.randomUUID());
  const status = data.status === "accepted" || data.status === "filled" || data.status === "rejected" || data.status === "cancelled" ? data.status : "pending";
  return {
    id,
    brokerOrderId: readString(data.brokerOrderId) || undefined,
    symbol: readString(data.symbol).toUpperCase(),
    side: readSide(data.side),
    type: readOrderType(data.type),
    volume: readNumber(data.volume),
    status,
    createdAt: readString(data.createdAt, new Date().toISOString()),
  };
}

function normalizeDeal(value: unknown): BrokerDeal {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    id: readString(data.id, crypto.randomUUID()),
    symbol: readString(data.symbol).toUpperCase(),
    side: readSide(data.side),
    volume: readNumber(data.volume),
    entryPrice: typeof data.entryPrice === "number" ? data.entryPrice : undefined,
    exitPrice: typeof data.exitPrice === "number" ? data.exitPrice : undefined,
    stopLoss: typeof data.stopLoss === "number" ? data.stopLoss : undefined,
    takeProfit: typeof data.takeProfit === "number" ? data.takeProfit : undefined,
    profit: typeof data.profit === "number" ? data.profit : undefined,
    commission: typeof data.commission === "number" ? data.commission : undefined,
    swap: typeof data.swap === "number" ? data.swap : undefined,
    openedAt: readString(data.openedAt) || undefined,
    closedAt: readString(data.closedAt) || undefined,
    source: readBrokerSource(data.source),
  };
}

export function createBrokersRouter(
  runtime: BrokerHubRuntime = brokerHubRuntime,
  options: BrokersRouterOptions = {},
): IRouter {
  const router = Router();
  const intentStore = options.intentStore ?? createConnectionIntentStore();
  const providerRegistry = options.providerRegistry ?? createDefaultBrokerProviderRegistry();
  const companionStore = options.companionStore ?? defaultCompanionStore;
  const smartLinkService = options.smartLinkService ?? defaultMt5SmartLinkService;
  const fxBlueSetupIntentStore = options.fxBlueSetupIntentStore ?? createFxBlueSetupIntentStore();
  const legacyConnectionRoutesEnabled = options.enableLegacyConnectionRoutes === true;

  router.get("/brokers/catalog", (_req, res) => {
    const catalog = legacyConnectionRoutesEnabled ? BROKER_CATALOG : FXBLUE_ONLY_CATALOG;
    res.json({
      brokers: catalog.map((broker) => ({
        id: broker.id,
        displayName: broker.displayName,
        defaultAccountLabel: broker.defaultAccountLabel,
        category: broker.category,
        primaryProviderKind: broker.primaryProviderKind,
        recommendedRoute: broker.recommendedRoute,
        availableRoutes: broker.availableRoutes,
        userFields: broker.userFields,
      })),
    });
  });

  if (!legacyConnectionRoutesEnabled) {
    router.post("/brokers/connect-intents", blockLegacyConnectionRoute);
    router.get("/brokers/connect-intents/:id", blockLegacyConnectionRoute);
    router.post("/brokers/connect-intents/:id/verify", blockLegacyConnectionRoute);
    router.post("/brokers/connect-intents/:id/complete", blockLegacyConnectionRoute);
    router.post("/brokers/smartlink/mt5/start", blockLegacyConnectionRoute);
    router.post("/brokers/smartlink/mt5/login", blockLegacyConnectionRoute);
    router.post("/brokers/companion/pairing", blockLegacyConnectionRoute);
    router.post("/brokers/import/history", blockLegacyConnectionRoute);
  }

  router.post("/brokers/fxblue/setup-intents", async (req, res) => {
    try {
      const intent = await fxBlueSetupIntentStore.createIntent({
        platform: req.body?.platform,
        brokerName: req.body?.brokerName,
        server: req.body?.server,
        accountNumber: req.body?.accountNumber,
        environment: req.body?.environment,
        investorPassword: req.body?.investorPassword,
        fxBlueProfileRef: req.body?.fxBlueProfileRef,
      });
      res.status(201).json({
        intent,
        fxBlueUrl: "https://diagnostics.fxblue.com/accountsync.aspx",
        instructions: [
          "Accedi o registrati su FX Blue.",
          "Seleziona Account Sync e scegli MT4 o MT5.",
          "Inserisci numero conto, server e password investor/read-only.",
          "Avvia la raccolta e torna nel Broker Hub.",
        ],
      });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/fxblue/setup-intents/:id/verify-profile", async (req, res) => {
    try {
      const intent = await fxBlueSetupIntentStore.getIntent(req.params.id);
      if (!intent) {
        res.status(404).json({ error: "FX Blue setup intent non trovato." });
        return;
      }
      const fxBlueProfileRef = parseFxBlueProfileRef(readString(req.body?.fxBlueProfileRef));
      const tempProfile = await runtime.saveProfile({
        label: `${intent.brokerName} FX Blue`,
        brokerName: intent.brokerName,
        kind: "fxblue-account-sync",
        providerKind: "fxblue-account-sync",
        ownerUserId: getUserId(req),
        providerUserId: fxBlueProfileRef,
        providerAccountId: fxBlueProfileRef,
        accountId: intent.accountNumber,
        environment: intent.environment,
        route: "fxblue_account_sync",
        health: "waiting_for_fxblue_sync",
        tradingEnabled: false,
        capabilities: {
          readAccount: true,
          readPositions: true,
          readHistory: true,
          placeOrders: false,
          closePositions: false,
          realtimeUpdates: false,
          requiresTerminal: false,
        },
        connectionStatus: "offline",
        setupProgress: "fxblue_profile_verifying",
        server: intent.server,
      });
      const connected = await runtime.connectProfile(tempProfile.id);
      const verified = await fxBlueSetupIntentStore.updateIntent(intent.id, {
        status: connected.snapshot.status === "connected" ? "profile_verified" : "waiting_for_sync",
        fxBlueProfileRef,
        profileId: tempProfile.id,
        displayStatus:
          connected.snapshot.status === "connected"
            ? "Profilo FX Blue verificato."
            : connected.snapshot.error ?? "In attesa del primo sync FX Blue.",
      });
      res.json({ intent: verified, profile: connected.profile, snapshot: connected.snapshot });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/fxblue/setup-intents/:id/complete", async (req, res) => {
    try {
      const intent = await fxBlueSetupIntentStore.getIntent(req.params.id);
      if (!intent) {
        res.status(404).json({ error: "FX Blue setup intent non trovato." });
        return;
      }
      if (!intent.profileId || !intent.fxBlueProfileRef) {
        res.status(400).json({ error: "Verifica prima il profilo FX Blue." });
        return;
      }
      const connected = await runtime.connectProfile(intent.profileId);
      const completed = await fxBlueSetupIntentStore.updateIntent(intent.id, {
        status: "completed",
        displayStatus: "Account Sync FX Blue collegato al Broker Hub.",
        profileId: intent.profileId,
      });
      const profile = await runtime.saveProfile({
        ...connected.profile,
        ownerUserId: connected.profile.ownerUserId ?? getUserId(req),
        tradingEnabled: false,
        capabilities: {
          ...connected.profile.capabilities,
          placeOrders: false,
          closePositions: false,
          realtimeUpdates: false,
          requiresTerminal: false,
        },
        health: connected.snapshot.status === "connected" ? "connected" : "waiting_for_fxblue_sync",
        setupProgress: connected.snapshot.status === "connected" ? "fxblue_connected" : "waiting_for_fxblue_sync",
        lastSnapshotAt: connected.snapshot.lastUpdated,
        connectionStatus: connected.snapshot.status,
      });
      res.status(201).json({ intent: completed, profile, snapshot: connected.snapshot });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/connect-intents", async (req, res) => {
    try {
      const broker = resolveBroker(String(req.body?.brokerName ?? "FP Trading"));
      const intent = await intentStore.createIntent({ brokerName: broker.displayName });
      const prepared = await intentStore.updateIntent(intent.id, {
        displayStatus:
          broker.recommendedRoute === "smartlink_mt5"
            ? `Collega ${broker.displayName} con SmartLink se hai MetaTrader, oppure con le credenziali broker.`
            : broker.recommendedRoute === "local_companion"
            ? `Installa o avvia TraderLoading Connector per collegare ${broker.displayName}.`
            : intent.displayStatus,
        safeDisplayStatus:
          broker.recommendedRoute === "smartlink_mt5"
            ? `Collega ${broker.displayName} con SmartLink se hai MetaTrader, oppure con le credenziali broker.`
            : broker.recommendedRoute === "local_companion"
            ? `Installa o avvia TraderLoading Connector per collegare ${broker.displayName}.`
            : intent.displayStatus,
        recommendedRoute: broker.recommendedRoute,
        availableRoutes: broker.availableRoutes,
        userAction:
          broker.recommendedRoute === "smartlink_mt5"
            ? "Usa SmartLink se hai MetaTrader 5 gia' installato, oppure inserisci numero conto, server e password."
            : broker.recommendedRoute === "local_companion"
            ? "Accedi nel terminale ufficiale e abbina TraderLoading Connector."
            : "Segui il collegamento sicuro del broker.",
        requiredAction: broker.recommendedRoute === "smartlink_mt5" || broker.recommendedRoute === "local_companion" ? "start_authorization" : intent.requiredAction,
      });
      res.status(201).json({ intent: publicIntent(prepared) });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/connect-intents/:id", async (req, res) => {
    try {
      const intent = await intentStore.getIntent(req.params.id);
      if (!intent) {
        res.status(404).json({ error: "Connection intent not found" });
        return;
      }
      res.json({ intent: publicIntent(intent) });
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  router.post("/brokers/connect-intents/:id/verify", async (req, res) => {
    try {
      const intent = await intentStore.getIntent(req.params.id);
      if (!intent) {
        res.status(404).json({ error: "Connection intent not found" });
        return;
      }

      const accountNumber = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.trim() : "";
      const accountPassword = typeof req.body?.accountPassword === "string" ? req.body.accountPassword : "";
      const server = typeof req.body?.server === "string" && req.body.server.trim() ? req.body.server.trim() : undefined;
      const broker = resolveBroker(intent.brokerName);
      if ((broker.recommendedRoute === "smartlink_mt5" || broker.recommendedRoute === "local_companion") && broker.category === "metatrader") {
        const verified = await intentStore.updateIntent(intent.id, {
          status: "verification_required",
          displayStatus:
            broker.recommendedRoute === "smartlink_mt5"
              ? "Usa SmartLink se hai MetaTrader, oppure collega il conto con numero conto, server e password."
              : "Avvia il TraderLoading Connector e abbina il conto MetaTrader.",
          safeDisplayStatus:
            broker.recommendedRoute === "smartlink_mt5"
              ? "Usa SmartLink se hai MetaTrader, oppure collega il conto con numero conto, server e password."
              : "Avvia il TraderLoading Connector e abbina il conto MetaTrader.",
          requiredAction: "start_authorization",
          recommendedRoute: broker.recommendedRoute,
          availableRoutes: broker.availableRoutes,
          userAction:
            broker.recommendedRoute === "smartlink_mt5"
              ? "Se MetaTrader 5 e' disponibile, SmartLink legge lo snapshot. Altrimenti usa le credenziali broker per il collegamento cloud configurato."
              : "Installa il Connector, apri MetaTrader e usa il codice di pairing.",
        });
        res.json({ intent: publicIntent(verified) });
        return;
      }
      if (broker.category === "brokerage") {
        if (!providerRegistry.startAuthorization) throw new Error("Collegamento broker azioni/crypto non configurato.");
        const started = await providerRegistry.startAuthorization({
          brokerName: broker.displayName,
          tradingEnabled: req.body?.tradingEnabled === true,
          customRedirect: typeof req.body?.customRedirect === "string" ? req.body.customRedirect : undefined,
        });
        await runtime.setSecret(intent.id, "snapTradeUserSecret", started.userSecret);
        const verified = await intentStore.updateIntent(intent.id, {
          status: "verification_required",
          displayStatus: started.displayStatus,
          requiredAction: "start_authorization",
          detectedConnectorKind: started.providerKind,
          providerKind: started.providerKind,
          providerUserId: started.providerUserId,
          authorizationUrl: started.authorizationUrl,
          sessionId: started.sessionId,
        });
        res.json({ intent: publicIntent(verified) });
        return;
      }
      if (!accountNumber || !accountPassword) {
        const verified = await intentStore.updateIntent(intent.id, {
          status: "verification_required",
          displayStatus: "Inserisci numero conto e password forniti dal broker",
          requiredAction: "advanced_setup_required",
        });
        res.json({ intent: publicIntent(verified) });
        return;
      }
      try {
        const verification = await providerRegistry.verifyAccount({
          brokerName: broker.displayName,
          accountNumber,
          accountPassword,
          server,
          tradingEnabled: req.body?.tradingEnabled === true,
        });
        const verified = await intentStore.updateIntent(intent.id, {
          status: verification.connectionStatus === "connected" ? "ready_to_complete" : "error",
          displayStatus: verification.userDisplayStatus,
          requiredAction: verification.connectionStatus === "connected" ? "ready_to_complete" : "advanced_setup_required",
          detectedAccountId: verification.accountId,
          detectedConnectorKind: verification.providerKind,
          providerKind: verification.providerKind,
          providerAccountId: verification.providerAccountId,
          capabilities: verification.capabilities,
          lastProviderError: undefined,
        });
        res.json({ intent: publicIntent(verified), snapshot: verification.snapshot });
        return;
      } catch (error) {
        const failed = await intentStore.updateIntent(intent.id, {
          status: "error",
          displayStatus: message(error),
          requiredAction: "advanced_setup_required",
          lastProviderError: message(error),
        });
        res.status(400).json({ intent: publicIntent(failed), error: message(error) });
        return;
      }
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  router.post("/brokers/connect-intents/:id/complete", async (req, res) => {
    try {
      const intent = await intentStore.getIntent(req.params.id);
      if (!intent) {
        res.status(404).json({ error: "Connection intent not found" });
        return;
      }

      const mode = typeof req.body?.mode === "string" ? req.body.mode : intent.status === "ready_to_complete" ? "verified" : "demo";
      const broker = resolveBroker(intent.brokerName);
      const advancedPlatform = typeof req.body?.platform === "string" ? req.body.platform : "";
      if (mode === "authorization") {
        if (!providerRegistry.completeAuthorization) throw new Error("Completamento broker azioni/crypto non configurato.");
        if (intent.providerKind !== "snaptrade-brokerage" || !intent.providerUserId) {
          res.status(400).json({ error: "Avvia prima il collegamento dal portale sicuro." });
          return;
        }
        const userSecret = await runtime.getSecret(intent.id, "snapTradeUserSecret");
        if (!userSecret) {
          res.status(400).json({ error: "Sessione portale scaduta. Riavvia il collegamento." });
          return;
        }
        const verification = await providerRegistry.completeAuthorization({
          providerKind: "snaptrade-brokerage",
          providerUserId: intent.providerUserId,
          userSecret,
          brokerName: broker.displayName,
          tradingEnabled: req.body?.tradingEnabled === true,
        });
        const profile = await runtime.saveProfile({
          label: verification.label,
          brokerName: broker.displayName,
          kind: verification.providerKind,
          providerKind: verification.providerKind,
          providerUserId: verification.providerUserId,
          providerAccountId: verification.providerAccountId,
          accountId: verification.accountId,
          environment: "live",
          tradingEnabled: req.body?.tradingEnabled === true,
          capabilities: verification.capabilities,
          connectionStatus: "offline",
        });
        await runtime.setSecret(profile.id, "snapTradeUserSecret", userSecret);
        await runtime.deleteSecrets(intent.id);
        const connected = await runtime.connectProfile(profile.id);
        if (connected.snapshot.status !== "connected") {
          await runtime.deleteProfile(profile.id);
          res.status(400).json({ error: connected.snapshot.error ?? "Conto broker non collegato." });
          return;
        }
        const completed = await intentStore.updateIntent(intent.id, {
          status: "completed",
          displayStatus: "Conto collegato",
          requiredAction: "none",
          detectedAccountId: profile.accountId,
          detectedConnectorKind: profile.kind,
          providerKind: profile.providerKind,
          providerUserId: profile.providerUserId,
          providerAccountId: profile.providerAccountId,
          capabilities: profile.capabilities,
          profileId: profile.id,
        });
        res.json({ intent: publicIntent(completed), profile, snapshot: connected.snapshot });
        return;
      }
      const profileKind =
        mode === "verified" && intent.providerKind
          ? intent.providerKind
          : mode === "credentials"
            ? "metaapi-metatrader"
            : mode === "advanced" && advancedPlatform === "mt5-vps"
              ? "mt5-vps-bridge"
              : mode === "advanced" && advancedPlatform === "api"
                ? "ctrader-open-api"
                : "demo";
      if (mode === "credentials") {
        const accountNumber = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.trim() : "";
        const accountPassword = typeof req.body?.accountPassword === "string" ? req.body.accountPassword : "";
        const server = typeof req.body?.server === "string" && req.body.server.trim() ? req.body.server.trim() : undefined;
        const verification = await providerRegistry.verifyAccount({
          brokerName: broker.displayName,
          accountNumber,
          accountPassword,
          server,
          tradingEnabled: req.body?.tradingEnabled === true,
        });
        const verified = await intentStore.updateIntent(intent.id, {
          status: "ready_to_complete",
          displayStatus: verification.userDisplayStatus,
          requiredAction: "ready_to_complete",
          detectedAccountId: verification.accountId,
          detectedConnectorKind: verification.providerKind,
          providerKind: verification.providerKind,
          providerAccountId: verification.providerAccountId,
          capabilities: verification.capabilities,
        });
        intent.status = verified.status;
        intent.detectedAccountId = verified.detectedAccountId;
        intent.providerKind = verified.providerKind;
        intent.providerAccountId = verified.providerAccountId;
        intent.capabilities = verified.capabilities;
      }
      if (mode === "verified" && (!intent.providerKind || !intent.providerAccountId || intent.status !== "ready_to_complete")) {
        res.status(400).json({ error: "Verifica prima il conto con numero conto e password." });
        return;
      }
      const resolvedProfileKind =
        mode === "credentials"
          ? intent.providerKind ?? "metaapi-metatrader"
          : mode === "verified" && intent.providerKind
            ? intent.providerKind
          : mode === "advanced" && advancedPlatform === "mt5-vps"
          ? "mt5-vps-bridge"
          : mode === "advanced" && advancedPlatform === "api"
            ? "ctrader-open-api"
            : "demo";
      const accountNumber =
        typeof req.body?.accountNumber === "string" && req.body.accountNumber.trim()
          ? req.body.accountNumber.trim()
          : undefined;
      const accountLabel =
        typeof req.body?.accountLabel === "string" && req.body.accountLabel.trim()
          ? req.body.accountLabel.trim()
          : accountNumber
            ? `${broker.defaultAccountLabel} ${accountNumber}`
          : resolvedProfileKind === "demo"
            ? `${broker.defaultAccountLabel} demo`
            : broker.defaultAccountLabel;

      const profile = await runtime.saveProfile({
        label: accountLabel,
        brokerName: resolvedProfileKind === "demo" ? "TraderLoading" : broker.displayName,
        kind: resolvedProfileKind,
        providerKind: resolvedProfileKind,
        providerUserId: intent.providerUserId,
        providerAccountId: intent.providerAccountId,
        accountId:
          intent.detectedAccountId ??
          accountNumber ??
          (typeof req.body?.accountId === "string" && req.body.accountId.trim()
            ? req.body.accountId.trim()
            : resolvedProfileKind === "demo"
              ? "DEMO-1"
              : ""),
        environment: resolvedProfileKind === "demo" ? "demo" : "live",
        tradingEnabled: req.body?.tradingEnabled === true,
        capabilities: intent.capabilities,
        connectionStatus: "offline",
        host: resolvedProfileKind === "mt5-vps-bridge" && typeof req.body?.host === "string" ? req.body.host : undefined,
        port: resolvedProfileKind === "mt5-vps-bridge" ? numberFrom(req.body?.port, 8765) : undefined,
        cTraderClientId:
          resolvedProfileKind === "ctrader-open-api" && typeof req.body?.clientId === "string" ? req.body.clientId : undefined,
        cTraderRedirectUri:
          resolvedProfileKind === "ctrader-open-api" && typeof req.body?.redirectUri === "string"
            ? req.body.redirectUri
            : undefined,
        server: typeof req.body?.server === "string" && req.body.server.trim() ? req.body.server.trim() : undefined,
      });

      if (typeof req.body?.bridgeToken === "string" && req.body.bridgeToken) {
        await runtime.setSecret(profile.id, "bridgeToken", req.body.bridgeToken);
      }
      if (typeof req.body?.accessToken === "string" && req.body.accessToken) {
        await runtime.setSecret(profile.id, "accessToken", req.body.accessToken);
      }
      if (typeof req.body?.clientSecret === "string" && req.body.clientSecret) {
        await runtime.setSecret(profile.id, "cTraderClientSecret", req.body.clientSecret);
      }

      const connected = await runtime.connectProfile(profile.id);
      if (connected.snapshot.status !== "connected" && resolvedProfileKind !== "mt5-vps-bridge") {
        await runtime.deleteProfile(profile.id);
        res.status(400).json({ error: connected.snapshot.error ?? "Conto non collegato. Verifica credenziali e server." });
        return;
      }
      const completed = await intentStore.updateIntent(intent.id, {
        status: "completed",
        displayStatus: "Conto collegato",
        requiredAction: "none",
        detectedAccountId: profile.accountId,
        detectedConnectorKind: profile.kind,
        providerKind: profile.providerKind,
        providerAccountId: profile.providerAccountId,
        capabilities: profile.capabilities,
        profileId: profile.id,
      });

      res.json({ intent: publicIntent(completed), profile, snapshot: connected.snapshot });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/profiles", async (_req, res) => {
    try {
      res.json(await runtime.listProfiles());
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles", async (req, res) => {
    try {
      const profile = await runtime.saveProfile(req.body);
      if (typeof req.body?.accessToken === "string" && req.body.accessToken) {
        await runtime.setSecret(profile.id, "accessToken", req.body.accessToken);
      }
      if (typeof req.body?.clientSecret === "string" && req.body.clientSecret) {
        await runtime.setSecret(profile.id, "cTraderClientSecret", req.body.clientSecret);
      }
      if (typeof req.body?.bridgeToken === "string" && req.body.bridgeToken) {
        await runtime.setSecret(profile.id, "bridgeToken", req.body.bridgeToken);
      }
      res.status(201).json({ profile });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/smartlink/mt5/start", async (req, res) => {
    try {
      const broker = resolveBroker(String(req.body?.brokerName ?? "FP Trading"));
      const tradingEnabled = req.body?.tradingEnabled === true;
      const existingProfiles = await runtime.listProfiles();
      const existing =
        typeof req.body?.profileId === "string"
          ? existingProfiles.profiles.find((profile) => profile.id === req.body.profileId)
          : undefined;
      const profile = await runtime.saveProfile({
        id: existing?.id,
        label: existing?.label ?? `${broker.defaultAccountLabel} SmartLink`,
        brokerName: broker.displayName,
        kind: "traderloading-mt5-smartlink",
        providerKind: "traderloading-mt5-smartlink",
        route: "smartlink_mt5",
        health: "waiting_for_companion",
        accountId: existing?.accountId ?? "",
        environment: existing?.environment ?? "live",
        tradingEnabled,
        capabilities: mt5SmartLinkCapabilities(tradingEnabled),
        connectionStatus: "offline",
        setupProgress: "detecting_terminal",
        terminalDetected: false,
        accountLoginMode: "terminal_session",
      });
      const activated = await runtime.connectProfile(profile.id);
      const status = await smartLinkService.start({
        profileId: profile.id,
        brokerName: broker.displayName,
        tradingEnabled,
        terminalPath: readString(req.body?.terminalPath) || undefined,
      });
      const updated = await runtime.saveProfile({
        id: profile.id,
        connectionStatus: activated.snapshot.status,
        health: status.connected ? "connected" : "waiting_for_companion",
        terminalDetected: status.terminalDetected,
        terminalPath: status.terminalPath,
        lastBridgeHeartbeatAt: new Date().toISOString(),
        setupProgress: status.terminalDetected ? "terminal_detected" : "detecting_terminal",
      });
      res.status(201).json({ profile: updated, status, snapshot: activated.snapshot });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/smartlink/mt5/status", async (req, res) => {
    try {
      const profileId = readString(req.query.profileId);
      if (!profileId) {
        res.status(400).json({ error: "Profilo SmartLink richiesto." });
        return;
      }
      const status = await smartLinkService.status(profileId);
      const profiles = await runtime.listProfiles();
      const profile = profiles.profiles.find((item) => item.id === profileId);
      const snapshot = await runtime.getSnapshot(profileId).catch(() => undefined);
      const visibleStatus =
        snapshot?.status === "connected"
          ? {
              ...status,
              status: "connected" as const,
              connected: true,
              terminalDetected: true,
              message: "Conto sincronizzato.",
            }
          : status;
      if (profile) {
        await runtime.saveProfile({
          id: profileId,
          terminalDetected: visibleStatus.terminalDetected,
          terminalPath: visibleStatus.terminalPath,
          health: snapshot?.status === "connected" ? "connected" : "waiting_for_companion",
          connectionStatus: snapshot?.status ?? profile.connectionStatus,
          lastBridgeHeartbeatAt: new Date().toISOString(),
          setupProgress: snapshot?.status === "connected" ? "account_synced" : status.terminalDetected ? "terminal_detected" : "detecting_terminal",
        });
      }
      res.json(visibleStatus);
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/smartlink/mt5/login", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      const accountNumber = readString(req.body?.accountNumber);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const serverName = readString(req.body?.server);
      if (!profileId || !accountNumber || !password || !serverName) {
        res.status(400).json({ error: "Numero conto, password e server sono richiesti." });
        return;
      }
      const status = await smartLinkService.login({
        profileId,
        accountNumber,
        password,
        server: serverName,
        terminalPath: readString(req.body?.terminalPath) || undefined,
      });
      const updated = await runtime.saveProfile({
        id: profileId,
        accountId: accountNumber,
        server: serverName,
        accountLoginMode: "credentials",
        terminalDetected: status.terminalDetected,
        terminalPath: status.terminalPath,
        setupProgress: "login_requested",
        lastBridgeHeartbeatAt: new Date().toISOString(),
      });
      res.json({ profile: updated, status });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/smartlink/mt5/stop", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      if (!profileId) {
        res.status(400).json({ error: "Profilo SmartLink richiesto." });
        return;
      }
      const status = await smartLinkService.stop(profileId);
      const updated = await runtime.saveProfile({
        id: profileId,
        connectionStatus: "offline",
        health: "stale",
        setupProgress: "stopped",
        lastBridgeHeartbeatAt: new Date().toISOString(),
      });
      res.json({ profile: updated, status });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/smartlink/mt5/diagnostics", async (req, res) => {
    try {
      const profileId = readString(req.query.profileId);
      if (!profileId) {
        res.status(400).json({ error: "Profilo SmartLink richiesto." });
        return;
      }
      res.json(await smartLinkService.diagnostics(profileId));
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/companion/pairing", async (req, res) => {
    try {
      const broker = resolveBroker(String(req.body?.brokerName ?? "Qualsiasi broker MetaTrader"));
      const tradingEnabled = req.body?.tradingEnabled === true;
      const profile = await runtime.saveProfile({
        label: `${broker.defaultAccountLabel} Connector`,
        brokerName: broker.displayName,
        kind: "metatrader-local-companion",
        providerKind: "metatrader-local-companion",
        route: "local_companion",
        health: "waiting_for_companion",
        accountId: "",
        environment: "live",
        tradingEnabled,
        capabilities: localCompanionCapabilities(tradingEnabled),
        connectionStatus: "offline",
        setupProgress: "waiting_for_companion",
      });
      const pairing = await companionStore.createPairing({ profileId: profile.id, brokerName: broker.displayName });
      const activated = await runtime.connectProfile(profile.id);
      const visibleProfile = { ...activated.profile, connectionStatus: activated.snapshot.status };
      res.status(201).json({
        profile: visibleProfile,
        snapshot: activated.snapshot,
        pairing: {
          token: pairing.token,
          expiresAt: pairing.expiresAt,
          instructions: [
            "Apri MetaTrader con il tuo conto broker.",
            "Avvia TraderLoading Connector.",
            "Inserisci questo codice di pairing nel Connector.",
          ],
        },
      });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/companion/downloads/mt5-ea", async (_req, res) => {
    try {
      const source = await readMt5ConnectorSource();
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.setHeader("content-disposition", 'attachment; filename="TraderLoadingConnector.mq5"');
      res.send(source);
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  router.get("/brokers/companion/downloads/mt5-settings", async (req, res) => {
    try {
      const profileId = readString(req.query.profileId);
      const token = readString(req.query.token);
      if (!profileId || !token) {
        res.status(400).json({ error: "Codice profilo e codice di abbinamento richiesti." });
        return;
      }
      const apiBase = appBaseUrl(req.query.apiBase);
      const tradingEnabled = readString(req.query.tradingEnabled).toLowerCase() === "true";
      const settings = [
        `ApiBase=${apiBase}`,
        `ProfileId=${profileId}`,
        `PairingCode=${token}`,
        `AllowLiveTrading=${tradingEnabled ? "true" : "false"}`,
        "SyncSeconds=5",
        "",
      ].join("\r\n");
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.setHeader("content-disposition", 'attachment; filename="TraderLoadingConnector.set"');
      res.send(settings);
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  router.get("/brokers/companion/status/:profileId", async (req, res) => {
    try {
      const profileId = req.params.profileId;
      const health = await companionStore.getHealth(profileId);
      const snapshot = await companionStore.getSnapshot(profileId);
      const connected = health === "connected" && snapshot?.status === "connected";
      res.json({
        profileId,
        health,
        connected,
        hasSnapshot: Boolean(snapshot),
        lastUpdated: snapshot?.lastUpdated,
        message: connected
          ? "Conto sincronizzato."
          : health === "stale"
            ? "Connector rilevato, dati non ancora aggiornati."
            : "In attesa del TraderLoading Connector.",
      });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/companion/heartbeat", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      const token = readString(req.body?.token);
      const existing = await runtime.listProfiles();
      const existingProfile = existing.profiles.find((item) => item.id === profileId);
      const isSmartLink = existingProfile?.providerKind === "traderloading-mt5-smartlink" && token === "smartlink";
      const heartbeat = isSmartLink
        ? { lastHeartbeatAt: new Date().toISOString() }
        : await companionStore.heartbeat({ profileId, token, terminal: readString(req.body?.terminal) || undefined });
      const profile = await runtime.saveProfile({
        id: profileId,
        lastHeartbeatAt: heartbeat.lastHeartbeatAt,
        lastBridgeHeartbeatAt: heartbeat.lastHeartbeatAt,
        health: isSmartLink ? "waiting_for_companion" : await companionStore.getHealth(profileId),
        terminalDetected: isSmartLink ? true : existingProfile?.terminalDetected,
        setupProgress: "terminal_detected",
      });
      res.json({ ok: true, health: profile.health, lastHeartbeatAt: profile.lastHeartbeatAt });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/companion/snapshot", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      const token = readString(req.body?.token);
      const existing = await runtime.listProfiles();
      const profile = existing.profiles.find((item) => item.id === profileId);
      if (!profile) throw new Error("Profilo Connector non trovato.");
      const account = normalizeAccount(req.body?.account, profile.brokerName);
      const rawMetrics = typeof req.body?.metrics === "object" && req.body.metrics !== null ? req.body.metrics as Record<string, unknown> : {};
      const partialCapabilities = typeof req.body?.capabilities === "object" && req.body.capabilities !== null ? req.body.capabilities as Partial<BrokerCapabilities> : {};
      const capabilities = {
        ...localCompanionCapabilities(profile.tradingEnabled),
        ...partialCapabilities,
        placeOrders: profile.tradingEnabled && partialCapabilities.placeOrders !== false,
        closePositions: profile.tradingEnabled && partialCapabilities.closePositions !== false,
      };
      const snapshot: BrokerSnapshot = {
        profileId,
        status: "connected",
        kind: "metatrader-local-companion",
        providerKind: "metatrader-local-companion",
        brokerName: profile.brokerName,
        tradingEnabled: profile.tradingEnabled,
        accounts: [account],
        metrics: {
          balance: readNumber(rawMetrics.balance),
          equity: readNumber(rawMetrics.equity),
          margin: readNumber(rawMetrics.margin),
          freeMargin: readNumber(rawMetrics.freeMargin),
          currency: readString(rawMetrics.currency, account.currency),
          dailyProfit: readNumber(rawMetrics.dailyProfit),
        },
        positions: Array.isArray(req.body?.positions) ? req.body.positions.map(normalizePosition) : [],
        orders: Array.isArray(req.body?.orders) ? req.body.orders.map(normalizeOrder) : [],
        lastUpdated: new Date().toISOString(),
      };
      const savedSnapshot =
        profile.providerKind === "traderloading-mt5-smartlink" && token === "smartlink"
          ? await companionStore.importSnapshot({ profileId, snapshot, deals: [] }).then(() => snapshot)
          : await companionStore.saveSnapshot({ profileId, token, snapshot, capabilities });
      const updated = await runtime.saveProfile({
        id: profileId,
        accountId: account.id,
        label: account.label,
        environment: account.environment,
        route: profile.providerKind === "traderloading-mt5-smartlink" ? "smartlink_mt5" : "local_companion",
        health: "connected",
        connectionStatus: "connected",
        capabilities,
        lastSnapshotAt: savedSnapshot.lastUpdated,
        lastBridgeHeartbeatAt: new Date().toISOString(),
        terminalDetected: profile.providerKind === "traderloading-mt5-smartlink" ? true : profile.terminalDetected,
        setupProgress: capabilities.placeOrders ? "trading_available" : "read_only",
      });
      res.json({ ok: true, profile: updated, snapshot: savedSnapshot });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/companion/history", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      const token = readString(req.body?.token);
      const deals: BrokerDeal[] = Array.isArray(req.body?.deals) ? req.body.deals.map(normalizeDeal) : [];
      const existing = await runtime.listProfiles();
      const profile = existing.profiles.find((item) => item.id === profileId);
      const saved =
        profile?.providerKind === "traderloading-mt5-smartlink" && token === "smartlink"
          ? await companionStore.getSnapshot(profileId).then(async (snapshot) => {
              await companionStore.importSnapshot({
                profileId,
                snapshot:
                  snapshot ?? {
                    profileId,
                    status: "connecting",
                    kind: "traderloading-mt5-smartlink",
                    providerKind: "traderloading-mt5-smartlink",
                    brokerName: profile.brokerName,
                    tradingEnabled: profile.tradingEnabled,
                    accounts: [],
                    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
                    positions: [],
                    orders: [],
                    lastUpdated: new Date().toISOString(),
                  },
                deals,
              });
              return deals;
            })
          : await companionStore.saveHistory({ profileId, token, deals });
      res.json({ ok: true, imported: saved.length });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/companion/orders/pending", async (req, res) => {
    try {
      const profileId = readString(req.query.profileId);
      const token = readString(req.query.token);
      const existing = await runtime.listProfiles();
      const profile = existing.profiles.find((item) => item.id === profileId);
      const orders =
        profile?.providerKind === "traderloading-mt5-smartlink" && token === "smartlink"
          ? await companionStore.listPendingOrdersTrusted(profileId)
          : await companionStore.listPendingOrders(profileId, token);
      res.json({ orders });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/companion/orders/:id/result", async (req, res) => {
    try {
      const profileId = readString(req.body?.profileId);
      const token = readString(req.body?.token);
      const result = {
        accepted: req.body?.accepted === true,
        orderId: req.params.id,
        brokerOrderId: readString(req.body?.brokerOrderId) || undefined,
        reason: readString(req.body?.reason) || undefined,
      };
      const existing = await runtime.listProfiles();
      const profile = existing.profiles.find((item) => item.id === profileId);
      const pending =
        profile?.providerKind === "traderloading-mt5-smartlink" && token === "smartlink"
          ? await companionStore.completeOrderTrusted({ profileId, orderId: req.params.id, result })
          : await companionStore.completeOrder({ profileId, token, orderId: req.params.id, result });
      res.json({
        ok: true,
        order: {
          id: pending.id,
          brokerOrderId: pending.result?.brokerOrderId,
          symbol: pending.order.symbol,
          side: pending.order.side,
          type: pending.order.type,
          volume: pending.order.volume,
          status: pending.status,
          createdAt: pending.createdAt,
        },
      });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/import/history", async (req, res) => {
    try {
      const brokerName = readString(req.body?.brokerName, "Broker importato");
      const accountId = readString(req.body?.accountId, `IMPORT-${Date.now()}`);
      const accountLabel = readString(req.body?.accountLabel, `${brokerName} import`);
      const deals: BrokerDeal[] = Array.isArray(req.body?.deals) ? req.body.deals.map(normalizeDeal) : [];
      if (deals.length === 0) throw new Error("Importa almeno un trade chiuso dal report broker.");
      const profit = deals.reduce((sum: number, deal: BrokerDeal) => sum + (deal.profit ?? 0), 0);
      const profile = await runtime.saveProfile({
        label: accountLabel,
        brokerName,
        kind: "metatrader-local-companion",
        providerKind: "metatrader-local-companion",
        route: "file_import",
        health: "import_only",
        accountId,
        environment: "live",
        tradingEnabled: false,
        capabilities: {
          readAccount: false,
          readPositions: false,
          readHistory: true,
          placeOrders: false,
          closePositions: false,
          realtimeUpdates: false,
          requiresTerminal: false,
        },
        connectionStatus: "connected",
        setupProgress: "history_imported",
        lastSnapshotAt: new Date().toISOString(),
      });
      const snapshot: BrokerSnapshot = {
        profileId: profile.id,
        status: "connected",
        kind: "metatrader-local-companion",
        providerKind: "metatrader-local-companion",
        brokerName,
        tradingEnabled: false,
        accounts: [{ id: accountId, label: accountLabel, brokerName, currency: "USD", environment: "live" }],
        metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: profit },
        positions: [],
        orders: [],
        lastUpdated: new Date().toISOString(),
      };
      await companionStore.importSnapshot({ profileId: profile.id, snapshot, deals });
      res.status(201).json({ profile, snapshot, imported: deals.length });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles/:id/connect", async (req, res) => {
    try {
      await claimBrokerProfileForCurrentUser(runtime, req, req.params.id);
      res.json(await runtime.connectProfile(req.params.id));
    } catch (error) {
      res.status(404).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles/:id/disconnect", async (req, res) => {
    try {
      res.json(await runtime.disconnectProfile(req.params.id));
    } catch (error) {
      res.status(404).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles/:id/refresh", async (req, res) => {
    try {
      await claimBrokerProfileForCurrentUser(runtime, req, req.params.id);
      res.json(await runtime.refreshProfile(req.params.id));
    } catch (error) {
      res.status(404).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles/:id/orders", async (req, res) => {
    try {
      res.json(await runtime.placeOrder(req.params.id, req.body));
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.post("/brokers/profiles/:id/positions/:positionId/close", async (req, res) => {
    try {
      res.json(await runtime.closePosition(req.params.id, req.params.positionId));
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  router.get("/brokers/profiles/:id/snapshot", async (req, res) => {
    try {
      await claimBrokerProfileForCurrentUser(runtime, req, req.params.id);
      res.json(await runtime.getSnapshot(req.params.id));
    } catch (error) {
      res.status(404).json({ error: message(error) });
    }
  });

  router.get("/brokers/profiles/:id/history", async (req, res) => {
    try {
      await claimBrokerProfileForCurrentUser(runtime, req, req.params.id);
      res.json(await runtime.getHistory(req.params.id));
    } catch (error) {
      res.status(404).json({ error: message(error) });
    }
  });

  router.delete("/brokers/profiles/:id", async (req, res) => {
    try {
      await runtime.deleteProfile(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: message(error) });
    }
  });

  return router;
}

export default createBrokersRouter();
