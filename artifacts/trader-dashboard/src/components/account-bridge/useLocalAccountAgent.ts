import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountOrderDraft, AccountSnapshot } from "./types";

// Hook che parla DIRETTAMENTE con l'agente locale (127.0.0.1), senza passare dal
// backend dell'app. Le credenziali inviate via login() raggiungono solo l'agente.

export interface LocalAgentLogin {
  broker: string;
  accountNumber: string;
  password: string;
  server: string;
  mode: "demo" | "live";
  orderEnabled: boolean;
}

const EMPTY_SNAPSHOT: AccountSnapshot = {
  status: "offline",
  mode: "demo",
  adapter: "mt5-local-socket",
  orderEnabled: false,
  metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
  openTrades: [],
  closedTrades: [],
  lastUpdated: new Date(0).toISOString(),
};

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function useLocalAccountAgent(baseUrl: string) {
  const esRef = useRef<EventSource | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(EMPTY_SNAPSHOT);
  const [streamConnected, setStreamConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOrderMessage, setLastOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    const base = normalizeBase(baseUrl);
    if (!base) return;

    setLastError(null);
    let es: EventSource;
    try {
      es = new EventSource(`${base}/stream`);
    } catch {
      setLastError("Agente locale non raggiungibile");
      return;
    }
    esRef.current = es;

    es.onopen = () => setStreamConnected(true);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as
          | { type: "snapshot"; snapshot: AccountSnapshot }
          | { type: "order_ack"; result: { accepted: boolean; ticket?: string; reason?: string } }
          | { type: "error"; message: string };
        if (msg.type === "snapshot") {
          setSnapshot(msg.snapshot);
        } else if (msg.type === "order_ack") {
          setLastOrderMessage(
            msg.result.accepted ? `Ordine accettato ${msg.result.ticket ?? ""}`.trim() : msg.result.reason ?? "Ordine rifiutato",
          );
        } else if (msg.type === "error") {
          setLastError(msg.message);
        }
      } catch {
        /* ignora messaggi non validi */
      }
    };
    es.onerror = () => {
      setStreamConnected(false);
      setLastError("Agente locale non raggiungibile. Avvialo con: node scripts/account-agent/agent.mjs");
    };

    return () => {
      es.close();
      esRef.current = null;
      setStreamConnected(false);
    };
  }, [baseUrl]);

  const post = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${normalizeBase(baseUrl)}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json().catch(() => ({}))) as T & { reason?: string; error?: string };
      if (!res.ok) throw new Error(data.reason ?? data.error ?? `Agente: HTTP ${res.status}`);
      return data;
    },
    [baseUrl],
  );

  const login = useCallback(
    async (creds: LocalAgentLogin) => {
      setLastError(null);
      try {
        return await post<{ ok: boolean; account?: unknown }>("/login", creds);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login non riuscito";
        setLastError(message);
        throw error;
      }
    },
    [post],
  );

  const sendOrder = useCallback(
    async (order: AccountOrderDraft) => {
      try {
        const data = await post<{ accepted: boolean; ticket?: string; reason?: string }>("/order", order);
        setLastOrderMessage(
          data.accepted ? `Ordine accettato ${data.ticket ?? ""}`.trim() : data.reason ?? "Ordine rifiutato",
        );
        return data;
      } catch (error) {
        setLastOrderMessage(error instanceof Error ? error.message : "Ordine non inviato");
        return undefined;
      }
    },
    [post],
  );

  const logout = useCallback(async () => {
    try {
      await post("/logout", {});
    } catch {
      /* l'agente potrebbe essere già spento */
    }
  }, [post]);

  return useMemo(
    () => ({ snapshot, streamConnected, lastError, lastOrderMessage, login, sendOrder, logout }),
    [snapshot, streamConnected, lastError, lastOrderMessage, login, sendOrder, logout],
  );
}
