import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { createAccountBridgeRuntime, type AccountBridgeRuntime } from "./accountBridgeRuntime.js";
import { accountBridgeRuntime } from "./accountBridgeRuntimeSingleton.js";
import type { AccountBridgeConfig, AccountBridgeEvent } from "./types.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";

type ClientMessage = {
  type?: string;
  requestId?: string;
  payload?: unknown;
};

export interface AccountBridgeWebSocketServer {
  service: AccountBridgeRuntime;
  close(): Promise<void>;
}

function send(client: WebSocket, event: AccountBridgeEvent): void {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify(event));
}

function parseClientMessage(raw: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as ClientMessage) : null;
  } catch {
    return null;
  }
}

function isRuntime(value: AccountBridgeConfig | AccountBridgeRuntime): value is AccountBridgeRuntime {
  return "activateConfig" in value;
}

export function attachAccountBridgeWebSocket(
  server: Server,
  config: AccountBridgeConfig | AccountBridgeRuntime = accountBridgeRuntime,
): AccountBridgeWebSocketServer {
  const service = isRuntime(config) ? config : createAccountBridgeRuntime(config);
  const wss = new WebSocketServer({ noServer: true });
  let started = false;
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/account/ws") return;
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  async function ensureStarted(): Promise<void> {
    if (started) return;
    started = true;
    await service.start();
  }

  service.onEvent((event) => {
    for (const client of wss.clients) {
      send(client, event);
    }
  });

  wss.on("connection", (client) => {
    void (async () => {
      try {
        await ensureStarted();
        send(client, { type: "snapshot", snapshot: await service.getSnapshot() });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Account bridge unavailable";
        send(client, { type: "error", message });
      }
    })();

    client.on("message", (raw) => {
      const message = parseClientMessage(raw);

      if (!message) {
        send(client, { type: "error", message: "Invalid account bridge message" });
        return;
      }

      if (message.type === "refresh" || message.type === "subscribe") {
        void service.getSnapshot().then((snapshot) => {
          send(client, { type: "snapshot", snapshot });
        });
        return;
      }

      if (message.type === "place_order") {
        void service.placeOrder(message.payload, message.requestId);
      }
    });
  });

  return {
    service,
    async close(): Promise<void> {
      server.off("upgrade", onUpgrade);
      await service.stop();
      await closeWebSocketServer(wss);
    },
  };
}
