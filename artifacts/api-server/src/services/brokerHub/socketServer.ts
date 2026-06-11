import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { brokerHubRuntime, type BrokerHubRuntime } from "./runtime.js";
import type { BrokerEvent } from "./types.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { authorizeWebSocketUpgrade, type WebSocketAuthContext, type WebSocketSecurityOptions } from "../webSocketAuth.js";

interface ClientMessage {
  type?: string;
  profileId?: string;
  payload?: unknown;
}

export interface BrokerHubWebSocketServer {
  close(): Promise<void>;
}

async function defaultRequireBrokerPro(auth: WebSocketAuthContext): Promise<boolean> {
  const { isUserPro } = await import("../../lib/billing.js");
  return isUserPro(auth.userId);
}

function send(client: WebSocket, event: BrokerEvent): void {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
}

function eventProfileId(event: BrokerEvent): string | null {
  if (event.type === "snapshot") return event.snapshot.profileId;
  return event.profileId ?? null;
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
  security: WebSocketSecurityOptions = {},
): BrokerHubWebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const socketSecurity: WebSocketSecurityOptions = {
    ...security,
    requireProAccess: security.requireProAccess ?? defaultRequireBrokerPro,
  };
  const clientAuth = new WeakMap<WebSocket, WebSocketAuthContext>();

  async function ownsProfile(userId: string, profileId: string): Promise<boolean> {
    const profiles = await runtime.listProfiles();
    return profiles.profiles.some((profile) => profile.id === profileId && profile.ownerUserId === userId);
  }

  async function requireOwnedProfile(client: WebSocket, profileId: string): Promise<boolean> {
    const auth = clientAuth.get(client);
    if (!auth || !(await ownsProfile(auth.userId, profileId))) {
      send(client, { type: "broker_error", profileId, message: "Broker profile not found" });
      return false;
    }
    return true;
  }

  async function sendIfAuthorized(client: WebSocket, event: BrokerEvent): Promise<void> {
    const profileId = eventProfileId(event);
    if (!profileId) {
      send(client, event);
      return;
    }
    const auth = clientAuth.get(client);
    if (auth && await ownsProfile(auth.userId, profileId)) send(client, event);
  }

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/brokers/ws") return;
    void (async () => {
      const auth = await authorizeWebSocketUpgrade(request, socket, socketSecurity);
      if (!auth) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })();
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = runtime.onEvent((event) => {
    for (const client of wss.clients) void sendIfAuthorized(client, event);
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: WebSocketAuthContext) => {
    clientAuth.set(client, auth);
    client.on("message", (raw: WebSocket.RawData) => {
      const message = parse(raw);
      if (!message) {
        send(client, { type: "broker_error", message: "Invalid broker hub message" });
        return;
      }

      if (message.type === "connect" && message.profileId) {
        void (async () => {
          if (!(await requireOwnedProfile(client, message.profileId!))) return;
          const { snapshot } = await runtime.connectProfile(message.profileId!);
          send(client, { type: "snapshot", snapshot });
        })().catch((error) => {
          send(client, { type: "broker_error", profileId: message.profileId, message: error instanceof Error ? error.message : "Broker request failed" });
        });
        return;
      }

      if (message.type === "snapshot" && message.profileId) {
        void (async () => {
          if (!(await requireOwnedProfile(client, message.profileId!))) return;
          const snapshot = await runtime.getSnapshot(message.profileId!);
          send(client, { type: "snapshot", snapshot });
        })().catch((error) => {
          send(client, { type: "broker_error", profileId: message.profileId, message: error instanceof Error ? error.message : "Broker request failed" });
        });
        return;
      }

      if (message.type === "place_order" && message.profileId) {
        void (async () => {
          if (!(await requireOwnedProfile(client, message.profileId!))) return;
          await runtime.placeOrder(message.profileId!, message.payload);
        })().catch((error) => {
          send(client, { type: "broker_error", profileId: message.profileId, message: error instanceof Error ? error.message : "Broker request failed" });
        });
      }
    });
  });

  return {
    async close(): Promise<void> {
      unsubscribe();
      server.off("upgrade", onUpgrade);
      await closeWebSocketServer(wss);
    },
  };
}
