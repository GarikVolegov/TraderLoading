export type BrokerKind =
  | "traderloading-mt5-smartlink"
  | "metatrader-local-companion"
  | "metaapi-metatrader"
  | "snaptrade-brokerage"
  | "ctrader-open-api"
  | "mt5-vps-bridge"
  | "fxblue-account-sync"
  | "demo";
export type BrokerEnvironment = "demo" | "live";
export type BrokerStatus = "offline" | "connecting" | "connected" | "error";
export type ConnectorRoute =
  | "smartlink_mt5"
  | "official_oauth"
  | "local_companion"
  | "broker_portal"
  | "file_import"
  | "manual"
  | "optional_cloud"
  | "advanced_ea"
  | "fxblue_account_sync";
export type ConnectionHealth = "connected" | "stale" | "waiting_for_companion" | "waiting_for_fxblue_sync" | "import_only" | "error";
export type BrokerHubTab = "connect" | "accounts" | "terminal" | "order" | "history";
export type BrokerConnectionIntentStatus = "created" | "verification_required" | "ready_to_complete" | "completed" | "error";
export type BrokerConnectionRequiredAction =
  | "start_authorization"
  | "advanced_setup_required"
  | "ready_to_complete"
  | "none";

export interface BrokerAccountProfile {
  id: string;
  label: string;
  brokerName: string;
  kind: BrokerKind;
  providerKind: BrokerKind;
  providerUserId?: string;
  providerAccountId?: string;
  accountId: string;
  environment: BrokerEnvironment;
  tradingEnabled: boolean;
  capabilities: {
    readAccount: boolean;
    readPositions: boolean;
    readHistory: boolean;
    placeOrders: boolean;
    closePositions: boolean;
    realtimeUpdates?: boolean;
    requiresTerminal?: boolean;
  };
  route: ConnectorRoute;
  health: ConnectionHealth;
  connectionStatus: BrokerStatus;
  lastHeartbeatAt?: string;
  lastBridgeHeartbeatAt?: string;
  lastSnapshotAt?: string;
  setupProgress?: string;
  terminalPath?: string;
  terminalDetected?: boolean;
  accountLoginMode?: "terminal_session" | "credentials";
  host?: string;
  port?: number;
  cTraderClientId?: string;
  cTraderRedirectUri?: string;
  server?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerConnectionIntent {
  id: string;
  brokerName: string;
  status: BrokerConnectionIntentStatus;
  displayStatus: string;
  detectedAccountId?: string;
  authorizationUrl?: string;
  sessionId?: string;
  requiredAction: BrokerConnectionRequiredAction;
  recommendedRoute?: ConnectorRoute;
  availableRoutes?: ConnectorRoute[];
  userAction?: string;
  safeDisplayStatus?: string;
  profileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerProfileList {
  activeProfileId: string | null;
  profiles: BrokerAccountProfile[];
}

export interface BrokerMetrics {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  dailyProfit: number;
}

export interface BrokerPosition {
  id: string;
  brokerPositionId: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entryPrice?: number;
  markPrice?: number;
  profit?: number;
  openedAt?: string;
  source: BrokerKind;
}

export interface BrokerOrder {
  id: string;
  brokerOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  volume: number;
  status: "pending" | "accepted" | "filled" | "rejected" | "cancelled";
  createdAt: string;
}

export interface BrokerDeal {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  openedAt?: string;
  closedAt?: string;
  source: BrokerKind;
}

export interface BrokerSnapshot {
  profileId: string;
  status: BrokerStatus;
  kind: BrokerKind;
  providerKind?: BrokerKind;
  brokerName: string;
  tradingEnabled: boolean;
  accounts: Array<{ id: string; label: string; brokerName: string; currency: string; environment: BrokerEnvironment }>;
  metrics: BrokerMetrics;
  positions: BrokerPosition[];
  orders: BrokerOrder[];
  lastUpdated: string;
  error?: string;
}

export interface BrokerOrderDraft {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  volume: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}
