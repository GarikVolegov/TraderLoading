import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { brokerHubRuntime, type BrokerHubRuntime } from "./runtime.js";
import type { BrokerEvent } from "./types.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { authorizeWebSocketUpgrade, rejectWebSocketUpgrade, type WebSocketAuthContext, type WebSocketSecurityOptions } from "../webSocketAuth.js";
import {
  canSend,
  createControlWebSocketServer,
  createSocketRateLimiter,
  startHeartbeat,
} from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";

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
  if (canSend(client)) client.send(JSON.stringify(event));
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
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);
  const socketSecurity: WebSocketSecurityOptions = {
    ...security,
    requireProAccess: security.requireProAccess ?? defaultRequireBrokerPro,
  };
  const clientAuth = new WeakMap<WebSocket, WebSocketAuthContext>();
  const allowSocketMessage = createSocketRateLimiter(60, 10_000);

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

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/brokers/ws") return;
    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }
    void (async () => {
      const auth = await authorizeWebSocketUpgrade(request, socket, socketSecurity);
      if (!auth || socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })().catch(() => {
      rejectWebSocketUpgrade(socket, 503, "Service Unavailable");
    });
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = runtime.onEvent((event) => {
    if (wss.clients.size === 0) return;
    const profileId = eventProfileId(event);
    const serialized = JSON.stringify(event);
    if (!profileId) {
      for (const client of wss.clients) {
        if (canSend(client)) client.send(serialized);
      }
      return;
    }
    void runtime
      .listProfiles()
      .then(({ profiles }) => {
        const ownerUserId = profiles.find((p) => p.id === profileId)?.ownerUserId;
        if (!ownerUserId) return;
        for (const client of wss.clients) {
          const auth = clientAuth.get(client);
          if (auth && auth.userId === ownerUserId && canSend(client)) {
            client.send(serialized);
          }
        }
      })
      .catch(() => {});
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: WebSocketAuthContext) => {
    clientAuth.set(client, auth);
    client.on("message", (raw: WebSocket.RawData) => {
      if (!allowSocketMessage(client)) return;
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
      stopHeartbeat();
      await closeWebSocketServer(wss);
    },
  };
}
