import type { AccountBridgeConfig, AccountOrderRequest } from "./types.js";

const SYMBOL_PATTERN = /^[A-Za-z0-9._:/-]{1,32}$/;

function parsePort(value: string | undefined): number {
  if (value == null) return 8765;

  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 8765;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumericField(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

export function parseBridgeConfig(env: NodeJS.ProcessEnv): AccountBridgeConfig {
  const mode = env.ACCOUNT_BRIDGE_MODE === "live" ? "live" : "demo";
  const adapter =
    env.ACCOUNT_BRIDGE_ADAPTER === "mt5-local-socket"
      ? "mt5-local-socket"
      : env.ACCOUNT_BRIDGE_ADAPTER === "demo"
        ? "demo"
        : mode === "live"
          ? "mt5-local-socket"
          : "demo";

  return {
    adapter,
    mode,
    host: env.ACCOUNT_BRIDGE_HOST ?? "127.0.0.1",
    port: parsePort(env.ACCOUNT_BRIDGE_PORT),
    importJournal: env.ACCOUNT_BRIDGE_IMPORT_JOURNAL !== "false",
    orderEnabled: env.ACCOUNT_BRIDGE_ORDER_ENABLED === "true",
    orderAckTimeoutMs: parsePositiveInteger(env.ACCOUNT_BRIDGE_ORDER_ACK_TIMEOUT_MS, 10_000),
  };
}

export function validateOrderRequest(
  raw: unknown,
  capability: { mode: "demo" | "live"; orderEnabled: boolean },
): { ok: true; order: AccountOrderRequest } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "Order payload must be an object" };

  const data = raw as Record<string, unknown>;
  const rawSymbol = typeof data.symbol === "string" ? data.symbol.trim() : "";
  const direction = data.direction;
  const volume = parseNumericField(data.volume);
  const stopLoss = data.stopLoss == null || data.stopLoss === "" ? undefined : parseNumericField(data.stopLoss);
  const takeProfit = data.takeProfit == null || data.takeProfit === "" ? undefined : parseNumericField(data.takeProfit);
  const comment = typeof data.comment === "string" ? data.comment.trim().slice(0, 120) : undefined;

  if (!rawSymbol) return { ok: false, reason: "Symbol is required" };
  if (rawSymbol.length > 32) return { ok: false, reason: "Symbol must be 32 characters or fewer" };
  if (!SYMBOL_PATTERN.test(rawSymbol)) return { ok: false, reason: "Symbol contains unsupported characters" };
  if (direction !== "buy" && direction !== "sell") return { ok: false, reason: "Direction must be buy or sell" };
  if (!Number.isFinite(volume) || volume <= 0) return { ok: false, reason: "Volume must be greater than zero" };
  if (stopLoss !== undefined && (!Number.isFinite(stopLoss) || stopLoss <= 0)) {
    return { ok: false, reason: "Stop loss must be a positive price" };
  }
  if (takeProfit !== undefined && (!Number.isFinite(takeProfit) || takeProfit <= 0)) {
    return { ok: false, reason: "Take profit must be a positive price" };
  }
  if (capability.mode === "live" && !capability.orderEnabled) {
    return { ok: false, reason: "Live order sending is disabled" };
  }

  const symbol = rawSymbol.toUpperCase();
  return { ok: true, order: { symbol, direction, volume, stopLoss, takeProfit, comment } };
}
