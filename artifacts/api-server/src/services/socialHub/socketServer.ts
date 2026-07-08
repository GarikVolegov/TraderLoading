import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { db, communityChannelsTable, communityChannelEntitlementsTable } from "@workspace/db";
import { getMemberContext, hasPermission } from "../communityPermissions.js";
import { canAccessChannel, isChannelFree } from "../community/channelAccess.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { authorizeWebSocketUpgrade, rejectWebSocketUpgrade, type WebSocketAuthContext, type WebSocketSecurityOptions } from "../webSocketAuth.js";
import { canSend, createControlWebSocketServer, startHeartbeat } from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
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

/** Channel access mirrors the HTTP read gate (assertChannelAccess): community
 *  membership for free channels, plus an active entitlement (or owner/channels.manage)
 *  for paid channels — so live push never leaks a locked paid channel's messages. */
async function defaultCanAccessChannel(userId: string, channelId: number): Promise<boolean> {
  const [channel] = await db
    .select({ communityId: communityChannelsTable.communityId, priceCredits: communityChannelsTable.priceCredits })
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, channelId))
    .limit(1);
  if (!channel) return false;

  const ctx = await getMemberContext(channel.communityId, userId);
  if (ctx.isBanned) return false;
  if (!ctx.isMember && !ctx.isOwner) return false;

  if (isChannelFree({ priceCredits: channel.priceCredits })) return true;

  const [entitlement] = await db
    .select({ expiresAt: communityChannelEntitlementsTable.expiresAt })
    .from(communityChannelEntitlementsTable)
    .where(and(
      eq(communityChannelEntitlementsTable.channelId, channelId),
      eq(communityChannelEntitlementsTable.userId, userId),
    ))
    .limit(1);
  return canAccessChannel({
    isFree: false,
    isOwner: ctx.isOwner,
    canManage: hasPermission(ctx, "channels.manage"),
    entitlement: entitlement ?? null,
    now: new Date(),
  });
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
    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }
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
