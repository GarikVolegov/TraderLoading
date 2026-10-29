import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import {
  authenticateWebSocketUpgrade,
  authorizeWebSocketUpgrade,
  rejectWebSocketUpgrade,
  type WebSocketAuthContext,
  type WebSocketSecurityOptions,
} from "../webSocketAuth.js";
import { isAllowedWebSocketOrigin } from "../../lib/security.js";
import logger from "../../lib/logger.js";
import {
  canSend,
  createControlWebSocketServer,
  createSocketRateLimiter,
  startHeartbeat,
} from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
import { battleRoomManager } from "./battleRoomManager.js";
import { registerBattleInvitePushBridge } from "./battleInviteDispatcher.js";
import type {
  BattleRoomClientMessage,
  BattleRoomServerMessage,
} from "./battleRoomTypes.js";

export interface BattleRoomSocketServer {
  close(): Promise<void>;
}

function parseClientMessage(raw: WebSocket.RawData): BattleRoomClientMessage | null {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as BattleRoomClientMessage) : null;
  } catch {
    return null;
  }
}

/**
 * Real-time Battle Room WebSocket server for Prove del Fuoco (Limen Protocol).
 * Clients connect to `/api/backtest/battle-rooms/ws` and exchange telemetry, live trades,
 * and stoic discipline sentences with other participants in the same arena.
 */
export function attachBattleRoomWebSocket(
  server: Server,
  security: WebSocketSecurityOptions = {},
): BattleRoomSocketServer {
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);
  const unregisterPushBridge = registerBattleInvitePushBridge(battleRoomManager);

  // Track rooms each socket is currently joined to
  const socketRooms = new WeakMap<WebSocket, Set<string>>();
  const socketSpectatorRooms = new WeakMap<WebSocket, Set<string>>();
  const socketUsers = new WeakMap<WebSocket, string>();
  const socketUnsubs = new WeakMap<WebSocket, Map<string, () => void>>();
  const allowSocketMessage = createSocketRateLimiter(80, 10_000);

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/backtest/battle-rooms/ws") return;

    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }

    void (async () => {
      const origin = Array.isArray(request.headers.origin)
        ? request.headers.origin[0]
        : request.headers.origin;
      const host = Array.isArray(request.headers.host)
        ? request.headers.host[0]
        : request.headers.host;
      if (!isAllowedWebSocketOrigin(origin, host)) {
        rejectWebSocketUpgrade(socket, 403, "Forbidden");
        return;
      }

      // Check authentication without destroying the socket on anonymous/guest fallback
      const authenticate = security.authenticate ?? authenticateWebSocketUpgrade;
      let auth: WebSocketAuthContext | null = null;
      try {
        auth = await authenticate(request);
      } catch (err) {
        logger.warn({ err }, "Battle room websocket auth lookup failed; falling back to guest");
      }

      if (auth) {
        // Authenticated session: attach full authorization + lease watcher
        const authorized = await authorizeWebSocketUpgrade(request, socket, {
          ...security,
          authenticate: async () => auth,
        });
        if (!authorized || socket.destroyed) return;
        auth = authorized;
      } else {
        // Fallback guest identifier if cookies/tokens are not provided.
        // Always namespace under `guest_` to prevent impersonating real authenticated userIds.
        const rawGuest = (url.searchParams.get("guestId") || "")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 24);
        const guestId = rawGuest
          ? rawGuest.startsWith("guest_")
            ? rawGuest
            : `guest_${rawGuest}`
          : `guest_${Math.random().toString(36).substring(2, 9)}`;
        auth = { userId: guestId, source: "session" };
      }

      if (socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })().catch((err) => {
      logger.warn({ err }, "Battle room websocket upgrade failed");
      rejectWebSocketUpgrade(socket, 503, "Service Unavailable");
    });
  };

  server.on("upgrade", onUpgrade);

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: { userId: string }) => {
    socketUsers.set(client, auth.userId);
    socketRooms.set(client, new Set());
    socketSpectatorRooms.set(client, new Set());
    socketUnsubs.set(client, new Map());

    const sendMsg = (msg: BattleRoomServerMessage, preSerialized?: string) => {
      if (canSend(client)) {
        client.send(preSerialized ?? JSON.stringify(msg));
      }
    };

    client.on("message", (raw) => {
      if (!allowSocketMessage(client)) {
        return;
      }
      const msg = parseClientMessage(raw);
      if (!msg || typeof msg.type !== "string") return;

      const userId = socketUsers.get(client) || auth.userId;
      const validRoomId =
        "roomId" in msg && typeof msg.roomId === "string" && msg.roomId.length > 0 && msg.roomId.length <= 128
          ? msg.roomId
          : null;

      if (validRoomId) {
        battleRoomManager.touchParticipant(validRoomId, userId);
      }

      try {
        switch (msg.type) {
          case "join_room": {
            if (!validRoomId) return;
            const { roomId, tournamentId, user, rules } = msg;
            const safeTournamentId =
              typeof tournamentId === "number" && Number.isFinite(tournamentId) ? tournamentId : 1;
            const joinedRooms = socketRooms.get(client);
            joinedRooms?.add(roomId);

            battleRoomManager.joinRoom(
              roomId,
              safeTournamentId,
              {
                userId,
                displayName:
                  typeof user?.displayName === "string" && user.displayName.trim()
                    ? user.displayName.trim().slice(0, 48)
                    : `Operatore ${userId.slice(-4)}`,
                avatarUrl: typeof user?.avatarUrl === "string" ? user.avatarUrl.slice(0, 512) : undefined,
                country: typeof user?.country === "string" ? user.country.slice(0, 8) : "IT",
                gradeTitle:
                  typeof user?.gradeTitle === "string"
                    ? user.gradeTitle.slice(0, 64)
                    : "Custode della Regola",
                tribeTag: typeof user?.tribeTag === "string" ? user.tribeTag.slice(0, 24) : undefined,
                isReady: Boolean(user?.isReady),
                currentProfitPct:
                  typeof user?.currentProfitPct === "number" && Number.isFinite(user.currentProfitPct)
                    ? user.currentProfitPct
                    : 0,
                currentDrawdownPct:
                  typeof user?.currentDrawdownPct === "number" && Number.isFinite(user.currentDrawdownPct)
                    ? user.currentDrawdownPct
                    : 0,
                tradesCount:
                  typeof user?.tradesCount === "number" && Number.isFinite(user.tradesCount)
                    ? Math.max(0, Math.floor(user.tradesCount))
                    : 0,
              },
              rules && typeof rules === "object" ? rules : undefined,
            );

            // Send immediate snapshot of current room participants & rules to joining client
            const snapshotData = battleRoomManager.getRoomSnapshotData(roomId);
            sendMsg({
              type: "room_snapshot",
              roomId,
              participants: snapshotData.participants,
              tournamentId: safeTournamentId,
              rules: snapshotData.rules,
              isStarting: snapshotData.isStarting,
            });

            // Then subscribe to ongoing room broadcasts
            const unsubsMap = socketUnsubs.get(client);
            if (!unsubsMap?.has(roomId)) {
              const unsub = battleRoomManager.subscribe(roomId, sendMsg);
              unsubsMap?.set(roomId, unsub);
            }
            break;
          }

          case "spectate_room": {
            if (!validRoomId) return;
            const { roomId } = msg;
            const spectatingRooms = socketSpectatorRooms.get(client);
            spectatingRooms?.add(roomId);

            const { snapshot, spectatorCount } = battleRoomManager.spectateRoom(roomId, userId);

            sendMsg({
              type: "room_snapshot",
              roomId,
              participants: snapshot.participants,
              tournamentId: 1,
              rules: snapshot.rules,
              isStarting: snapshot.isStarting,
              matchStartedAt: snapshot.matchStartedAt,
              matchEndsAt: snapshot.matchEndsAt,
              durationSeconds: snapshot.durationSeconds,
              spectatorCount,
            });

            // Subscribe to ongoing room broadcasts for live telemetry & trade flow
            const unsubsMap = socketUnsubs.get(client);
            if (!unsubsMap?.has(roomId)) {
              const unsub = battleRoomManager.subscribe(roomId, sendMsg);
              unsubsMap?.set(roomId, unsub);
            }
            break;
          }

          case "leave_spectate": {
            if (!validRoomId) return;
            const { roomId } = msg;
            const spectatingRooms = socketSpectatorRooms.get(client);
            spectatingRooms?.delete(roomId);
            const unsubsMap = socketUnsubs.get(client);
            unsubsMap?.get(roomId)?.();
            unsubsMap?.delete(roomId);
            battleRoomManager.leaveSpectate(roomId, userId);
            break;
          }

          case "set_ready_status": {
            if (!validRoomId) return;
            battleRoomManager.setReady(validRoomId, userId, Boolean(msg.isReady));
            break;
          }

          case "start_battle_request": {
            if (!validRoomId) return;
            void battleRoomManager.startBattle(validRoomId).catch((err) => {
              logger.warn({ err, roomId: validRoomId }, "Battle room startBattle failed");
            });
            break;
          }

          case "send_lobby_invite": {
            if (!validRoomId || typeof msg.targetUserId !== "string" || !msg.targetUserId.trim()) return;
            const participants = battleRoomManager.getSnapshot(validRoomId);
            const senderName =
              participants.find((p) => p.userId === userId)?.displayName || "Comandante";
            battleRoomManager.sendInvite(validRoomId, senderName, msg.targetUserId.trim().slice(0, 128));
            break;
          }

          case "leave_room": {
            if (!validRoomId) return;
            const { roomId } = msg;
            socketRooms.get(client)?.delete(roomId);
            const unsub = socketUnsubs.get(client)?.get(roomId);
            if (unsub) {
              unsub();
              socketUnsubs.get(client)?.delete(roomId);
            }
            battleRoomManager.leaveRoom(roomId, userId);
            break;
          }

          case "trade_executed": {
            if (!validRoomId || !msg.trade || typeof msg.trade !== "object") return;
            const rawTrade = msg.trade;
            if (
              (rawTrade.type !== "BUY" && rawTrade.type !== "SELL" && rawTrade.type !== "CLOSE") ||
              typeof rawTrade.price !== "number" ||
              !Number.isFinite(rawTrade.price)
            ) {
              return;
            }
            battleRoomManager.recordTrade(validRoomId, {
              ...rawTrade,
              userId,
              displayName:
                typeof rawTrade.displayName === "string" && rawTrade.displayName.trim()
                  ? rawTrade.displayName.trim().slice(0, 48)
                  : `Operatore ${userId.slice(-4)}`,
              timestamp:
                typeof rawTrade.timestamp === "number" && Number.isFinite(rawTrade.timestamp)
                  ? rawTrade.timestamp
                  : Date.now(),
            });
            break;
          }

          case "telemetry_update": {
            if (!validRoomId) return;
            const profitPct =
              typeof msg.profitPct === "number" && Number.isFinite(msg.profitPct) ? msg.profitPct : 0;
            const drawdownPct =
              typeof msg.drawdownPct === "number" && Number.isFinite(msg.drawdownPct)
                ? Math.max(0, msg.drawdownPct)
                : 0;
            const tradesCount =
              typeof msg.tradesCount === "number" && Number.isFinite(msg.tradesCount)
                ? Math.max(0, Math.floor(msg.tradesCount))
                : 0;
            battleRoomManager.updateTelemetry(validRoomId, userId, {
              profitPct,
              drawdownPct,
              tradesCount,
              biometricBpm: msg.biometricBpm,
              biometricShareConsent: msg.biometricShareConsent === true,
            });
            break;
          }

          case "send_stoic_sentence": {
            if (!validRoomId || typeof msg.sentence !== "string" || !msg.sentence.trim()) return;
            const participants = battleRoomManager.getSnapshot(validRoomId);
            const sender =
              participants.find((p) => p.userId === userId)?.displayName || "Operatore";
            battleRoomManager.broadcastStoicSentence(
              validRoomId,
              sender,
              msg.sentence.trim().slice(0, 280),
            );
            break;
          }

          case "ping": {
            sendMsg({
              type: "pong",
              clientTimestamp: typeof msg.timestamp === "number" ? msg.timestamp : Date.now(),
              serverTimestamp: Date.now(),
            });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        logger.warn({ err, msgType: msg.type }, "Unhandled error in battleRoomSocket message handler");
      }
    });

    client.on("close", () => {
      const joinedRooms = socketRooms.get(client);
      const spectatingRooms = socketSpectatorRooms.get(client);
      const unsubs = socketUnsubs.get(client);
      if (joinedRooms) {
        for (const roomId of joinedRooms) {
          unsubs?.get(roomId)?.();
          battleRoomManager.leaveRoom(roomId, auth.userId);
        }
      }
      if (spectatingRooms) {
        for (const roomId of spectatingRooms) {
          unsubs?.get(roomId)?.();
          battleRoomManager.leaveSpectate(roomId, auth.userId);
        }
      }
    });
  });

  return {
    async close() {
      unregisterPushBridge();
      server.off("upgrade", onUpgrade);
      stopHeartbeat();
      await battleRoomManager.stop();
      await closeWebSocketServer(wss);
    },
  };
}
