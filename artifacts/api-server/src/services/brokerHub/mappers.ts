import type { BrokerPosition } from "./types.js";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function mapMt5Trade(raw: unknown): BrokerPosition {
  const trade = asObject(raw);
  const ticket = asString(trade.ticket);
  const direction = asString(trade.direction).toLowerCase() === "sell" ? "sell" : "buy";

  return {
    id: ticket,
    brokerPositionId: ticket,
    symbol: asString(trade.symbol).toUpperCase(),
    side: direction,
    volume: asNumber(trade.volume) ?? 0,
    entryPrice: asNumber(trade.entryPrice),
    markPrice: asNumber(trade.exitPrice),
    profit: asNumber(trade.profit),
    openedAt: typeof trade.openTime === "string" ? trade.openTime : undefined,
    source: "mt5-vps-bridge",
  };
}

export function mapCTraderPosition(raw: unknown, symbols: Record<number, string>): BrokerPosition {
  const position = asObject(raw);
  const tradeData = asObject(position.tradeData);
  const positionId = asString(position.positionId);
  const symbolId = asNumber(tradeData.symbolId) ?? 0;
  const side = asString(tradeData.tradeSide).toLowerCase() === "sell" ? "sell" : "buy";
  const rawVolume = asNumber(tradeData.volume) ?? 0;
  const openedAt =
    typeof tradeData.openTimestamp === "number" ? new Date(tradeData.openTimestamp).toISOString() : undefined;

  return {
    id: positionId,
    brokerPositionId: positionId,
    symbol: (symbols[symbolId] ?? String(symbolId)).toUpperCase(),
    side,
    volume: rawVolume / 100_000,
    entryPrice: asNumber(position.price),
    profit: asNumber(position.unrealizedNetProfit),
    openedAt,
    source: "ctrader-open-api",
  };
}
