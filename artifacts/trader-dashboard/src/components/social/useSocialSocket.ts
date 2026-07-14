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
    let ws: WebSocket;
    try {
      ws = new WebSocket(socialSocketUrl());
    } catch {
      return; // socket construction failed (e.g. bad URL) — polling still covers it
    }

    ws.onopen = () => {
      if (!closed) ws.send(JSON.stringify({ type: "subscribe", channelId }));
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as SocialSocketEvent;
        if (message.type === "community:message" && message.channelId === channelId) {
          callbackRef.current();
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, [channelId]);
}
