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
  const unmountedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(EMPTY_SNAPSHOT);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOrderMessage, setLastOrderMessage] = useState<string | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    clearReconnectTimer();
    const previous = wsRef.current;
    wsRef.current = null;
    previous?.close();

    setLastError(null);
    setSnapshot((prev) => ({ ...prev, status: "connecting" }));

    let ws: WebSocket;
    try {
      ws = new WebSocket(accountBridgeUrl());
      wsRef.current = ws;
    } catch {
      setSnapshot((prev) => ({ ...prev, status: "offline" }));
      return;
    }

    ws.onopen = () => {
      if (unmountedRef.current || wsRef.current !== ws) return;
      reconnectAttemptRef.current = 0;
      ws.send(JSON.stringify({ type: "subscribe" }));
    };

    ws.onmessage = (event) => {
      let message: AccountBridgeMessage;
      try {
        message = JSON.parse(String(event.data)) as AccountBridgeMessage;
      } catch {
        return;
      }

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
      if (wsRef.current !== ws) return;
      setLastError("Account bridge non disponibile");
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setSnapshot((prev) => ({ ...prev, status: "offline" }));
      if (!unmountedRef.current) {
        const baseDelay = Math.min(15_000, 1_500 * Math.pow(2, Math.min(reconnectAttemptRef.current, 4)));
        const jitter = Math.floor(Math.random() * 600);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!unmountedRef.current) {
            connect();
          }
        }, baseDelay + jitter);
      }
    };
  }, [clearReconnectTimer]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    const handleOnline = () => {
      if (unmountedRef.current) return;
      if (
        !wsRef.current ||
        wsRef.current.readyState === WebSocket.CLOSED ||
        wsRef.current.readyState === WebSocket.CLOSING
      ) {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      window.removeEventListener("online", handleOnline);
      const current = wsRef.current;
      wsRef.current = null;
      current?.close();
    };
  }, [connect, clearReconnectTimer]);

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
