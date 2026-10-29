import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { db, communityChannelsTable, communityChannelEntitlementsTable } from "@workspace/db";
import { getMemberContext, hasPermission } from "../communityPermissions.js";
import { canAccessChannel } from "../community/channelAccess.js";
import { isChannelFree } from "../community/channelPricing.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { authorizeWebSocketUpgrade, rejectWebSocketUpgrade, type WebSocketAuthContext, type WebSocketSecurityOptions } from "../webSocketAuth.js";
import {
  canSend,
  createControlWebSocketServer,
  createSocketRateLimiter,
  startHeartbeat,
} from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
import { closeSocialPubSub, onSocialEvent, shouldDeliverToChannelSubscriber, type SocialEvent } from "./socialEvents.js";
import { singleFlight } from "../../lib/singleFlight.js";
import logger from "../../lib/logger.js";

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

const CHANNEL_ACCESS_CACHE_TTL_MS = 15_000;
const CHANNEL_ACCESS_CACHE_MAX = 5_000;
const channelAccessCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const channelAccessInFlight = new Map<string, Promise<boolean>>();

export function invalidateChannelAccessCache(userId?: string, channelId?: number): void {
  if (!userId && channelId === undefined) {
    channelAccessCache.clear();
    return;
  }
  for (const key of channelAccessCache.keys()) {
    const [u, c] = key.split(":");
    if ((userId && u === userId) || (channelId !== undefined && Number(c) === channelId)) {
      channelAccessCache.delete(key);
    }
  }
}

/** Channel access mirrors the HTTP read gate (assertChannelAccess): community
 *  membership for free channels, plus an active entitlement (or owner/channels.manage)
 *  for paid channels — so live push never leaks a locked paid channel's messages. */
async function queryCanAccessChannel(userId: string, channelId: number): Promise<boolean> {
  const [channel] = await db
    .select({ communityId: communityChannelsTable.communityId, priceCents: communityChannelsTable.priceCents })
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, channelId))
    .limit(1);
  if (!channel) return false;

  const ctx = await getMemberContext(channel.communityId, userId);
  if (ctx.isBanned) return false;
  if (!ctx.isMember && !ctx.isOwner) return false;

  if (isChannelFree({ priceCents: channel.priceCents })) return true;

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

async function defaultCanAccessChannel(userId: string, channelId: number): Promise<boolean> {
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  const cached = channelAccessCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.allowed;
  }
  if (cached) channelAccessCache.delete(key);

  return singleFlight(channelAccessInFlight, key, async () => {
    const allowed = await queryCanAccessChannel(userId, channelId);
    if (channelAccessCache.size >= CHANNEL_ACCESS_CACHE_MAX && !channelAccessCache.has(key)) {
      const oldest = channelAccessCache.keys().next().value;
      if (oldest !== undefined) channelAccessCache.delete(oldest);
    }
    channelAccessCache.set(key, { allowed, expiresAt: Date.now() + CHANNEL_ACCESS_CACHE_TTL_MS });
    return allowed;
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
  const clientUsers = new WeakMap<WebSocket, string>();
  const clientChannels = new WeakMap<WebSocket, Set<number>>();
  const allowSocketMessage = createSocketRateLimiter(60, 10_000);

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/social/ws") return;
    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }
    void (async () => {
      const auth = await authorizeWebSocketUpgrade(request, socket, security);
      if (!auth || socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })().catch((err) => {
      logger.warn({ err }, "Social websocket upgrade failed");
      rejectWebSocketUpgrade(socket, 503, "Service Unavailable");
    });
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = onSocialEvent((event: SocialEvent) => {
    if (wss.clients.size === 0) return;
    const serialized = JSON.stringify(event);
    for (const client of wss.clients) {
      if (canSend(client) && shouldDeliverToChannelSubscriber(clientChannels.get(client), event)) {
        const userId = clientUsers.get(client);
        if (!userId) continue;
        void canAccessChannel(userId, event.channelId).then(allowed => {
          if (!allowed) { clientChannels.get(client)?.delete(event.channelId); return; }
          if (canSend(client) && shouldDeliverToChannelSubscriber(clientChannels.get(client), event)) client.send(serialized);
        }).catch(() => {});
      }
    }
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: WebSocketAuthContext) => {
    clientUsers.set(client, auth.userId);
    clientChannels.set(client, new Set<number>());

    client.on("message", (raw: WebSocket.RawData) => {
      if (!allowSocketMessage(client)) return;
      const message = parse(raw);
      if (!message) return;

      if (message.type === "ping") {
        if (canSend(client)) {
          client.send(JSON.stringify({ type: "pong" }));
        }
        return;
      }

      if (typeof message.channelId !== "number") return;
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
      await closeSocialPubSub();
      await closeWebSocketServer(wss);
    },
  };
}
