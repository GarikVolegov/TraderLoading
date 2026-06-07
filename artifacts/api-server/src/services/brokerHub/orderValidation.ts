import type { NormalizedBrokerOrderRequest, BrokerOrderSide, BrokerOrderType, BrokerTimeInForce } from "./types.js";

const SYMBOL_PATTERN = /^[A-Za-z0-9._:/-]{1,48}$/;

function readNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

function optionalPrice(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = readNumber(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSide(value: unknown): BrokerOrderSide | null {
  const side = typeof value === "string" ? value.toLowerCase() : "";
  return side === "buy" || side === "sell" ? side : null;
}

function normalizeType(value: unknown): BrokerOrderType | null {
  const type = typeof value === "string" ? value.toLowerCase() : "market";
  return type === "market" || type === "limit" || type === "stop" ? type : null;
}

function normalizeTif(value: unknown): BrokerTimeInForce {
  const tif = typeof value === "string" ? value.toLowerCase() : "";
  return tif === "day" || tif === "ioc" || tif === "fok" ? tif : "gtc";
}

export function normalizeBrokerOrder(
  raw: unknown,
): { ok: true; order: NormalizedBrokerOrderRequest } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "Order payload must be an object" };

  const data = raw as Record<string, unknown>;
  const symbol = typeof data.symbol === "string" ? data.symbol.trim().toUpperCase() : "";
  const side = normalizeSide(data.side);
  const type = normalizeType(data.type);
  const volume = readNumber(data.volume);
  const limitPrice = optionalPrice(data.limitPrice);
  const stopPrice = optionalPrice(data.stopPrice);
  const stopLoss = optionalPrice(data.stopLoss);
  const takeProfit = optionalPrice(data.takeProfit);
  const clientRequestId = typeof data.clientRequestId === "string" && data.clientRequestId.trim()
    ? data.clientRequestId.trim().slice(0, 80)
    : `order-${requestId()}`;

  if (!symbol) return { ok: false, reason: "Symbol is required" };
  if (!SYMBOL_PATTERN.test(symbol)) return { ok: false, reason: "Symbol contains unsupported characters" };
  if (!side) return { ok: false, reason: "Side must be buy or sell" };
  if (!type) return { ok: false, reason: "Order type must be market, limit or stop" };
  if (!Number.isFinite(volume) || volume <= 0) return { ok: false, reason: "Volume must be greater than zero" };
  if (limitPrice !== undefined && !Number.isFinite(limitPrice)) return { ok: false, reason: "Limit price must be positive" };
  if (stopPrice !== undefined && !Number.isFinite(stopPrice)) return { ok: false, reason: "Stop price must be positive" };
  if (stopLoss !== undefined && !Number.isFinite(stopLoss)) return { ok: false, reason: "Stop loss must be positive" };
  if (takeProfit !== undefined && !Number.isFinite(takeProfit)) return { ok: false, reason: "Take profit must be positive" };
  if (type === "limit" && limitPrice === undefined) return { ok: false, reason: "Limit orders require limitPrice" };
  if (type === "stop" && stopPrice === undefined) return { ok: false, reason: "Stop orders require stopPrice" };

  return {
    ok: true,
    order: {
      symbol,
      side,
      type,
      volume,
      limitPrice,
      stopPrice,
      stopLoss,
      takeProfit,
      timeInForce: normalizeTif(data.timeInForce),
      clientRequestId,
    },
  };
}
