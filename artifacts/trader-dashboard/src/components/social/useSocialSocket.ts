import { useEffect, useRef } from "react";

function socialSocketUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  const url = new URL("/api/social/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

type SocialSocketEvent = { type: "community:message"; channelId: number };

/**
 * Subscribe to real-time events for one community channel. On a community:message
 * push for this channel it invokes onChannelMessage (typically to invalidate the
 * messages query so the UI refreshes immediately).
 *
 * Best-effort by design: callers keep their polling query as the guaranteed
 * fallback, so a failed, blocked or closed socket simply means updates arrive on
 * the next poll instead of instantly — never a missed message. (The polling
 * cadence can be relaxed once this path is verified end-to-end in a browser.)
 */
export function useSocialSocket(channelId: number | null, onChannelMessage: () => void): void {
  const callbackRef = useRef(onChannelMessage);
  callbackRef.current = onChannelMessage;

  useEffect(() => {
    if (channelId === null) return;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let lastActivity = Date.now();
    let reconnectAttempt = 0;
    let currentWs: WebSocket | null = null;

    const clearTimers = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return;
      const baseDelay = Math.min(15_000, 1_500 * Math.pow(2, Math.min(reconnectAttempt, 4)));
      const jitter = Math.floor(Math.random() * 600);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!closed) {
          connectSocket();
        }
      }, baseDelay + jitter);
    };

    const startHeartbeat = (socket: WebSocket) => {
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
      lastActivity = Date.now();
      heartbeatTimer = setInterval(() => {
        if (closed || currentWs !== socket) return;
        if (socket.readyState === WebSocket.OPEN) {
          // If 45s have passed without any frame, the connection is zombie (silent drop)
          if (Date.now() - lastActivity > 45_000) {
            socket.close();
            return;
          }
          try {
            socket.send(JSON.stringify({ type: "ping" }));
          } catch {
            socket.close();
          }
        }
      }, 25_000);
    };

    const connectSocket = () => {
      if (closed) return;
      clearTimers();

      let ws: WebSocket;
      try {
        ws = new WebSocket(socialSocketUrl());
        currentWs = ws;
      } catch {
        return; // socket construction failed (e.g. bad URL) — polling still covers it
      }

      ws.onopen = () => {
        if (!closed && currentWs === ws) {
          reconnectAttempt = 0;
          lastActivity = Date.now();
          startHeartbeat(ws);
          ws.send(JSON.stringify({ type: "subscribe", channelId }));
        }
      };
      ws.onmessage = (event) => {
        lastActivity = Date.now();
        try {
          const message = JSON.parse(String(event.data)) as SocialSocketEvent;
          if (message.type === "community:message" && message.channelId === channelId) {
            callbackRef.current();
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (currentWs !== ws) return;
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (!closed) {
          scheduleReconnect();
        }
      };
    };

    const handleOnline = () => {
      if (closed) return;
      if (
        !currentWs ||
        currentWs.readyState === WebSocket.CLOSED ||
        currentWs.readyState === WebSocket.CLOSING
      ) {
        reconnectAttempt = 0;
        connectSocket();
      }
    };

    const handleVisibility = () => {
      if (closed) return;
      if (document.visibilityState === "visible") {
        if (
          !currentWs ||
          currentWs.readyState === WebSocket.CLOSED ||
          currentWs.readyState === WebSocket.CLOSING
        ) {
          reconnectAttempt = 0;
          connectSocket();
        }
      }
    };

    connectSocket();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      closed = true;
      clearTimers();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      currentWs?.close();
    };
  }, [channelId]);
}
