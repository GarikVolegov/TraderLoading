export type BrokerProviderKind =
  | "traderloading-mt5-smartlink"
  | "metatrader-local-companion"
  | "metaapi-metatrader"
  | "snaptrade-brokerage"
  | "ctrader-open-api"
  | "mt5-vps-bridge"
  | "fxblue-account-sync"
  | "demo";
export type BrokerKind = BrokerProviderKind;
export type BrokerEnvironment = "demo" | "live";
export type BrokerConnectionStatus = "offline" | "connecting" | "connected" | "error";
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
export type ConnectionCapability =
  | "readAccount"
  | "readPositions"
  | "readHistory"
  | "placeOrders"
  | "closePositions"
  | "realtimeUpdates"
  | "requiresTerminal";
export type ConnectionHealth =
  | "connected"
  | "stale"
  | "waiting_for_companion"
  | "waiting_for_fxblue_sync"
  | "import_only"
  | "error";
export type BrokerConnectionIntentStatus = "created" | "verification_required" | "ready_to_complete" | "completed" | "error";
export type BrokerConnectionRequiredAction =
  | "start_authorization"
  | "advanced_setup_required"
  | "ready_to_complete"
  | "none";
export type BrokerOrderSide = "buy" | "sell";
export type BrokerOrderType = "market" | "limit" | "stop";
export type BrokerTimeInForce = "gtc" | "day" | "ioc" | "fok";

export interface BrokerCapabilities {
  readAccount: boolean;
  readPositions: boolean;
  readHistory: boolean;
  placeOrders: boolean;
  closePositions: boolean;
  realtimeUpdates?: boolean;
  requiresTerminal?: boolean;
}

export interface BrokerAccountProfile {
  id: string;
  label: string;
  brokerName: string;
  kind: BrokerKind;
  providerKind: BrokerProviderKind;
  providerUserId?: string;
  providerAccountId?: string;
  accountId: string;
  environment: BrokerEnvironment;
  route: ConnectorRoute;
  health: ConnectionHealth;
  tradingEnabled: boolean;
  capabilities: BrokerCapabilities;
  connectionStatus: BrokerConnectionStatus;
  lastHeartbeatAt?: string;
  lastBridgeHeartbeatAt?: string;
  lastSnapshotAt?: string;
  setupProgress?: string;
  terminalPath?: string;
  terminalDetected?: boolean;
  accountLoginMode?: "terminal_session" | "credentials";
  host?: string;
  port?: number;
  bridgeTokenRef?: string;
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
  detectedConnectorKind?: BrokerKind;
  providerKind?: BrokerProviderKind;
  providerUserId?: string;
  providerAccountId?: string;
  authorizationUrl?: string;
  sessionId?: string;
  lastProviderError?: string;
  capabilities?: BrokerCapabilities;
  requiredAction: BrokerConnectionRequiredAction;
  profileId?: string;
  recommendedRoute?: ConnectorRoute;
  availableRoutes?: ConnectorRoute[];
  userAction?: string;
  safeDisplayStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerAccount {
  id: string;
  label: string;
  brokerName: string;
  currency: string;
  environment: BrokerEnvironment;
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
  side: BrokerOrderSide;
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
  side: BrokerOrderSide;
  type: BrokerOrderType;
  volume: number;
  status: "pending" | "accepted" | "filled" | "rejected" | "cancelled";
  createdAt: string;
}

export interface BrokerDeal {
  id: string;
  symbol: string;
  side: BrokerOrderSide;
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
  status: BrokerConnectionStatus;
  kind: BrokerKind;
  providerKind?: BrokerProviderKind;
  brokerName: string;
  tradingEnabled: boolean;
  accounts: BrokerAccount[];
  metrics: BrokerMetrics;
  positions: BrokerPosition[];
  orders: BrokerOrder[];
  lastUpdated: string;
  error?: string;
}

export interface NormalizedBrokerOrderRequest {
  symbol: string;
  side: BrokerOrderSide;
  type: BrokerOrderType;
  volume: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce: BrokerTimeInForce;
  clientRequestId: string;
  closePositionId?: string;
}

export interface BrokerOrderResult {
  accepted: boolean;
  orderId?: string;
  brokerOrderId?: string;
  reason?: string;
}

export type BrokerEvent =
  | { type: "snapshot"; snapshot: BrokerSnapshot }
  | { type: "position_update"; profileId: string; positions: BrokerPosition[] }
  | { type: "order_update"; profileId: string; order: BrokerOrder }
  | { type: "deal_closed"; profileId: string; deal: BrokerDeal }
  | { type: "broker_error"; profileId?: string; message: string };

export interface BrokerConnector {
  connect(): Promise<BrokerSnapshot>;
  disconnect(): Promise<void>;
  getAccounts(): Promise<BrokerAccount[]>;
  getSnapshot(): Promise<BrokerSnapshot>;
  getPositions(): Promise<BrokerPosition[]>;
  getOrders(): Promise<BrokerOrder[]>;
  getDealsHistory(): Promise<BrokerDeal[]>;
  placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult>;
  modifyOrder(orderId: string, patch: Partial<NormalizedBrokerOrderRequest>): Promise<BrokerOrderResult>;
  closePosition(positionId: string): Promise<BrokerOrderResult>;
  onEvent(listener: (event: BrokerEvent) => void): () => void;
}
