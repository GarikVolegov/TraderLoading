export type AccountConnectionMode = "demo" | "live";
export type AccountConnectionStatus = "offline" | "connecting" | "connected" | "error";
export type AccountTradeDirection = "buy" | "sell";
export type AccountTradeStatus = "open" | "closed";
export type AccountTradeSource = "demo" | "mt5";

export interface AccountBridgeConfig {
  adapter: "demo" | "mt5-local-socket";
  mode: AccountConnectionMode;
  host: string;
  port: number;
  importJournal: boolean;
  orderEnabled: boolean;
  orderAckTimeoutMs: number;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  dailyProfit: number;
}

export interface AccountIdentity {
  login?: string;
  name?: string;
  server?: string;
  broker?: string;
  leverage?: number;
  tradeMode?: string;
}

export interface AccountTrade {
  ticket: string;
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  openTime: string;
  closeTime?: string;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  status: AccountTradeStatus;
  source: AccountTradeSource;
}

export interface AccountSnapshot {
  status: AccountConnectionStatus;
  mode: AccountConnectionMode;
  adapter: AccountBridgeConfig["adapter"];
  orderEnabled: boolean;
  account?: AccountIdentity;
  metrics: AccountMetrics;
  openTrades: AccountTrade[];
  closedTrades: AccountTrade[];
  lastUpdated: string;
  error?: string;
}

export interface AccountOrderRequest {
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface AccountOrderResult {
  accepted: boolean;
  ticket?: string;
  reason?: string;
}

export type AccountBridgeEvent =
  | { type: "snapshot"; snapshot: AccountSnapshot }
  | { type: "account_update"; metrics: AccountMetrics }
  | { type: "positions_update"; openTrades: AccountTrade[] }
  | { type: "trade_closed"; trade: AccountTrade }
  | { type: "order_ack"; requestId?: string; result: AccountOrderResult }
  | { type: "order_rejected"; requestId?: string; reason: string }
  | { type: "journal_imported"; ticket: string; journalEntryId: number }
  | { type: "error"; message: string };

export interface AccountAdapter {
  readonly id: AccountBridgeConfig["adapter"];
  readonly mode: AccountConnectionMode;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<AccountSnapshot>;
  placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult>;
  onEvent(listener: (event: AccountBridgeEvent) => void): () => void;
}
