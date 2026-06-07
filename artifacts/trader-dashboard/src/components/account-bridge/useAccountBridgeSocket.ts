import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountBridgeMessage, AccountOrderDraft, AccountSnapshot } from "./types";

const EMPTY_SNAPSHOT: AccountSnapshot = {
  status: "offline",
  mode: "demo",
  adapter: "demo",
  orderEnabled: false,
  metrics: {
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    currency: "USD",
    dailyProfit: 0,
  },
  openTrades: [],
  closedTrades: [],
  lastUpdated: new Date(0).toISOString(),
};

function accountBridgeUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  const url = new URL("/api/account/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `account-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useAccountBridgeSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(EMPTY_SNAPSHOT);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOrderMessage, setLastOrderMessage] = useState<string | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    setLastError(null);
    setSnapshot((prev) => ({ ...prev, status: "connecting" }));

    const ws = new WebSocket(accountBridgeUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe" }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as AccountBridgeMessage;

      if (message.type === "snapshot") {
        setSnapshot(message.snapshot);
        return;
      }

      if (message.type === "account_update") {
        setSnapshot((prev) => ({ ...prev, metrics: message.metrics }));
        return;
      }

      if (message.type === "positions_update") {
        setSnapshot((prev) => ({
          ...prev,
          openTrades: message.openTrades,
          lastUpdated: new Date().toISOString(),
        }));
        return;
      }

      if (message.type === "trade_closed") {
        setSnapshot((prev) => ({
          ...prev,
          openTrades: prev.openTrades.filter((trade) => trade.ticket !== message.trade.ticket),
          closedTrades: [message.trade, ...prev.closedTrades],
          lastUpdated: new Date().toISOString(),
        }));
        return;
      }

      if (message.type === "order_ack") {
        setLastOrderMessage(
          message.result.accepted
            ? `Ordine accettato ${message.result.ticket ?? ""}`.trim()
            : message.result.reason ?? "Ordine rifiutato",
        );
        return;
      }

      if (message.type === "order_rejected") {
        setLastOrderMessage(message.reason);
        return;
      }

      if (message.type === "journal_imported") {
        setLastOrderMessage(`Trade ${message.ticket} importato nel diario`);
        return;
      }

      if (message.type === "error") {
        setLastError(message.message);
      }
    };

    ws.onerror = () => {
      setLastError("Account bridge non disponibile");
    };

    ws.onclose = () => {
      setSnapshot((prev) => ({ ...prev, status: "offline" }));
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendOrder = useCallback((order: AccountOrderDraft) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setLastOrderMessage("Socket account non connesso");
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "place_order", requestId: requestId(), payload: order }));
  }, []);

  return useMemo(
    () => ({
      snapshot,
      lastError,
      lastOrderMessage,
      reconnect: connect,
      sendOrder,
    }),
    [snapshot, lastError, lastOrderMessage, connect, sendOrder],
  );
}
