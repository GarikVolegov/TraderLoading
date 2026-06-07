import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { brokerHubRuntime, type BrokerHubRuntime } from "./runtime.js";
import type { BrokerEvent } from "./types.js";

interface ClientMessage {
  type?: string;
  profileId?: string;
  payload?: unknown;
}

export interface BrokerHubWebSocketServer {
  close(): Promise<void>;
}

function send(client: WebSocket, event: BrokerEvent): void {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
}

function parse(raw: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as ClientMessage) : null;
  } catch {
    return null;
  }
}

export function attachBrokerHubWebSocket(
  server: Server,
  runtime: BrokerHubRuntime = brokerHubRuntime,
): BrokerHubWebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/brokers/ws") return;
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = runtime.onEvent((event) => {
    for (const client of wss.clients) send(client, event);
  });

  wss.on("connection", (client) => {
    client.on("message", (raw) => {
      const message = parse(raw);
      if (!message) {
        send(client, { type: "broker_error", message: "Invalid broker hub message" });
        return;
      }

      if (message.type === "connect" && message.profileId) {
        void runtime.connectProfile(message.profileId).then(({ snapshot }) => send(client, { type: "snapshot", snapshot }));
        return;
      }

      if (message.type === "snapshot" && message.profileId) {
        void runtime.getSnapshot(message.profileId).then((snapshot) => send(client, { type: "snapshot", snapshot }));
        return;
      }

      if (message.type === "place_order" && message.profileId) {
        void runtime.placeOrder(message.profileId, message.payload);
      }
    });
  });

  return {
    async close(): Promise<void> {
      unsubscribe();
      server.off("upgrade", onUpgrade);
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
