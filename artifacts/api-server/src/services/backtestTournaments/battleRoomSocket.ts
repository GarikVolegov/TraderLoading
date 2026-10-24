import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import {
  authorizeWebSocketUpgrade,
  rejectWebSocketUpgrade,
  type WebSocketSecurityOptions,
} from "../webSocketAuth.js";
import { canSend, createControlWebSocketServer, startHeartbeat } from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
import { battleRoomManager } from "./battleRoomManager.js";
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

  // Track rooms each socket is currently joined to
  const socketRooms = new WeakMap<WebSocket, Set<string>>();
  const socketUsers = new WeakMap<WebSocket, string>();
  const socketUnsubs = new WeakMap<WebSocket, Map<string, () => void>>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/backtest/battle-rooms/ws") return;

    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }

    void (async () => {
      // Allow guest/demo tokens as fallback for anonymous traders in public rooms
      let auth = await authorizeWebSocketUpgrade(request, socket, security);
      if (!auth) {
        // Fallback guest identifier if cookies are not provided
        const guestId = url.searchParams.get("guestId") || `guest_${Math.random().toString(36).substring(2, 9)}`;
        auth = { userId: guestId, source: "session" };
      }

      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request, auth);
      });
    })();
  };

  server.on("upgrade", onUpgrade);

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, auth: { userId: string }) => {
    socketUsers.set(client, auth.userId);
    socketRooms.set(client, new Set());
    socketUnsubs.set(client, new Map());

    const sendMsg = (msg: BattleRoomServerMessage) => {
      if (canSend(client)) {
        client.send(JSON.stringify(msg));
      }
    };

    client.on("message", (raw) => {
      const msg = parseClientMessage(raw);
      if (!msg) return;

      const userId = socketUsers.get(client) || auth.userId;

      switch (msg.type) {
        case "join_room": {
          const { roomId, tournamentId, user, rules } = msg;
          const joinedRooms = socketRooms.get(client);
          joinedRooms?.add(roomId);

          battleRoomManager.joinRoom(roomId, tournamentId, {
            userId,
            displayName: user?.displayName || `Trader ${userId.slice(-4)}`,
            avatarUrl: user?.avatarUrl,
            country: user?.country || "IT",
            gradeTitle: user?.gradeTitle || "Custode della Regola",
            tribeTag: user?.tribeTag,
            isReady: user?.isReady ?? false,
            currentProfitPct: user?.currentProfitPct ?? 0,
            currentDrawdownPct: user?.currentDrawdownPct ?? 0,
            tradesCount: user?.tradesCount ?? 0,
          }, rules);

          // Send immediate snapshot of current room participants & rules to joining client
          const snapshotData = battleRoomManager.getRoomSnapshotData(roomId);
          sendMsg({
            type: "room_snapshot",
            roomId,
            participants: snapshotData.participants,
            tournamentId,
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

        case "set_ready_status": {
          battleRoomManager.setReady(msg.roomId, userId, msg.isReady);
          break;
        }

        case "start_battle_request": {
          void battleRoomManager.startBattle(msg.roomId);
          break;
        }

        case "send_lobby_invite": {
          const participants = battleRoomManager.getSnapshot(msg.roomId);
          const senderName = participants.find((p) => p.userId === userId)?.displayName || "Comandante";
          battleRoomManager.sendInvite(msg.roomId, senderName, msg.targetUserId);
          break;
        }

        case "leave_room": {
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
          battleRoomManager.recordTrade(msg.roomId, msg.trade);
          break;
        }

        case "telemetry_update": {
          battleRoomManager.updateTelemetry(msg.roomId, userId, {
            profitPct: msg.profitPct,
            drawdownPct: msg.drawdownPct,
            tradesCount: msg.tradesCount,
          });
          break;
        }

        case "send_stoic_sentence": {
          const participants = battleRoomManager.getSnapshot(msg.roomId);
          const sender = participants.find((p) => p.userId === userId)?.displayName || "Trader";
          battleRoomManager.broadcastStoicSentence(msg.roomId, sender, msg.sentence);
          break;
        }

        default:
          break;
      }
    });

    client.on("close", () => {
      const joinedRooms = socketRooms.get(client);
      const unsubs = socketUnsubs.get(client);
      if (joinedRooms) {
        for (const roomId of joinedRooms) {
          unsubs?.get(roomId)?.();
          battleRoomManager.leaveRoom(roomId, auth.userId);
        }
      }
    });
  });

  return {
    async close() {
      server.off("upgrade", onUpgrade);
      stopHeartbeat();
      await closeWebSocketServer(wss);
    },
  };
}
