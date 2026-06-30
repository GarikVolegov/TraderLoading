import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { db, communityChannelsTable, communityMembersTable } from "@workspace/db";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { authorizeWebSocketUpgrade, type WebSocketAuthContext, type WebSocketSecurityOptions } from "../webSocketAuth.js";
import { canSend, createControlWebSocketServer, startHeartbeat } from "../webSocketHeartbeat.js";
import { onSocialEvent, shouldDeliverToChannelSubscriber, type SocialEvent } from "./socialEvents.js";

interface ClientMessage {
  type?: string;
  channelId?: number;
}

export interface SocialHubSecurity extends WebSocketSecurityOptions {
  /** Verify a user may read a community channel (injectable for tests). */
  canAccessChannel?: (userId: string, channelId: number) => Promise<boolean>;
}

export interface SocialHubWebSocketServer {
  close(): Promise<void>;
}

/** Channel access == community membership, mirroring GET .../channels/:id/messages. */
async function defaultCanAccessChannel(userId: string, channelId: number): Promise<boolean> {
  const [channel] = await db
    .select({ communityId: communityChannelsTable.communityId })
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, channelId))
    .limit(1);
  if (!channel) return false;
  const [membership] = await db
    .select({ id: communityMembersTable.id })
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

function parse(raw: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as ClientMessage) : null;
  } catch {
    return null;
  }
}

/**
 * Social real-time push. Clients connect to /api/social/ws (authenticated via the
 * shared WS upgrade auth) and `subscribe` to community channels; membership is
 * verified once at subscribe time, after which channel events are pushed to the
 * subscriber so the UI can refresh without 3s polling. Leak-safe by construction:
 * an event only reaches a client whose verified subscription set contains the
 * channel (see shouldDeliverToChannelSubscriber).
 */
export function attachSocialHubWebSocket(server: Server, security: SocialHubSecurity = {}): SocialHubWebSocketServer {
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);
  const canAccessChannel = security.canAccessChannel ?? defaultCanAccessChannel;
  const clientChannels = new WeakMap<WebSocket, Set<number>>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/social/ws") return;
    void (async () => {
      const auth = await authorizeWebSocketUpgrade(request, socket, security);
      if (!auth) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })();
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = onSocialEvent((event: SocialEvent) => {
    for (const client of wss.clients) {
      if (canSend(client) && shouldDeliverToChannelSubscriber(clientChannels.get(client), event)) {
        client.send(JSON.stringify(event));
      }
    }
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: WebSocketAuthContext) => {
    clientChannels.set(client, new Set<number>());

    client.on("message", (raw: WebSocket.RawData) => {
      const message = parse(raw);
      if (!message || typeof message.channelId !== "number") return;
      const channelId = message.channelId;

      if (message.type === "subscribe") {
        void (async () => {
          // Only join the channel's delivery set once membership is verified;
          // an unauthorized subscribe is silently ignored (no error oracle).
          if (await canAccessChannel(auth.userId, channelId)) {
            clientChannels.get(client)?.add(channelId);
          }
        })().catch(() => {});
        return;
      }

      if (message.type === "unsubscribe") {
        clientChannels.get(client)?.delete(channelId);
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
