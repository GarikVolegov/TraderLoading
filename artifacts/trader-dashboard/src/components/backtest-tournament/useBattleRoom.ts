import { useEffect, useRef, useState, useCallback } from "react";
import type {
  RoomParticipant,
  RoomTradeBroadcast,
  BattleRoomClientMessage,
  BattleRoomServerMessage,
  RoomLobbyRules,
} from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";
import {
  synestheticArenaTradeWin,
  synestheticArenaTradeLoss,
  synestheticArenaDisqualification,
  synestheticArenaLaunch,
  synestheticArenaCountdown,
} from "@/lib/soundFx";

export type ConnectionHealth = "connected" | "degraded" | "reconnecting" | "offline";

type PendingAction =
  | { type: "trade"; payload: Omit<RoomTradeBroadcast, "id"> }
  | {
      type: "telemetry";
      payload: {
        profitPct: number;
        drawdownPct: number;
        tradesCount: number;
        biometricBpm?: number;
        biometricShareConsent?: boolean;
      };
    }
  | { type: "sentence"; payload: string };

function getBattleRoomWsUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  const url = new URL("/api/backtest/battle-rooms/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export interface UseBattleRoomOptions {
  roomId: string;
  tournamentId?: number;
  user?: Partial<RoomParticipant>;
  rules?: Partial<RoomLobbyRules>;
  enabled?: boolean;
  mode?: "combatant" | "spectator";
  onBattleLaunched?: (assignments: Record<string, { startCandleTs: number; sessionId?: number }>) => void;
  onMatchExpired?: () => void;
}

export function useBattleRoom({
  roomId,
  tournamentId = 1,
  user,
  rules,
  enabled = true,
  mode = "combatant",
  onBattleLaunched,
  onMatchExpired,
}: UseBattleRoomOptions) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [roomRules, setRoomRules] = useState<RoomLobbyRules | null>(null);
  const [recentTrades, setRecentTrades] = useState<RoomTradeBroadcast[]>([]);
  const [recentSentences, setRecentSentences] = useState<
    Array<{ sender: string; sentence: string; timestamp: number }>
  >([]);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [equityHistory, setEquityHistory] = useState<
    Array<{ timestamp: number; [key: string]: number }>
  >([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>(
    enabled ? "reconnecting" : "offline",
  );
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [matchSecondsRemaining, setMatchSecondsRemaining] = useState<number | null>(null);
  const [isMatchExpired, setIsMatchExpired] = useState(false);
  const [matchTiming, setMatchTiming] = useState<{
    matchStartedAt?: number;
    matchEndsAt?: number;
    durationSeconds?: number;
  }>({});
  const [lastDisqualification, setLastDisqualification] = useState<{
    displayName: string;
    reason: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingActionsRef = useRef<PendingAction[]>([]);
  const reconnectNowRef = useRef<() => void>(() => {});

  const onBattleLaunchedRef = useRef(onBattleLaunched);
  onBattleLaunchedRef.current = onBattleLaunched;
  const onMatchExpiredRef = useRef(onMatchExpired);
  onMatchExpiredRef.current = onMatchExpired;
  const userRef = useRef(user);
  userRef.current = user;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    if (!enabled || !roomId) {
      setConnectionHealth("offline");
      return;
    }

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let lastPongReceived = Date.now();
    let reconnectAttempt = 0;
    let currentWs: WebSocket | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (watchdogTimer !== null) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const flushPendingActions = (socket: WebSocket) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const actions = [...pendingActionsRef.current];
      pendingActionsRef.current = [];
      setPendingActionsCount(0);

      for (const action of actions) {
        try {
          if (action.type === "trade") {
            const msg: BattleRoomClientMessage = {
              type: "trade_executed",
              roomId,
              trade: action.payload,
            };
            socket.send(JSON.stringify(msg));
          } else if (action.type === "telemetry") {
            const msg: BattleRoomClientMessage = {
              type: "telemetry_update",
              roomId,
              ...action.payload,
            };
            socket.send(JSON.stringify(msg));
          } else if (action.type === "sentence") {
            const msg: BattleRoomClientMessage = {
              type: "send_stoic_sentence",
              roomId,
              sentence: action.payload,
            };
            socket.send(JSON.stringify(msg));
          }
        } catch {
          // Socket write error during flush
        }
      }
    };

    const startHeartbeat = (socket: WebSocket) => {
      stopHeartbeat();
      lastPongReceived = Date.now();

      // Application heartbeat: ping every 8 seconds
      heartbeatTimer = setInterval(() => {
        if (closed || socket.readyState !== WebSocket.OPEN) return;
        try {
          const pingMsg: BattleRoomClientMessage = {
            type: "ping",
            timestamp: Date.now(),
          };
          socket.send(JSON.stringify(pingMsg));
        } catch {
          // Socket write failed
        }
      }, 8_000);

      // Watchdog: detect dead zombie connection if no pong in 18s
      watchdogTimer = setInterval(() => {
        if (closed || socket.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastPongReceived > 18_000) {
          setConnectionHealth("degraded");
          try {
            socket.close();
          } catch {
            // Ignore close errors
          }
        }
      }, 4_000);
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return;
      setConnectionHealth("reconnecting");
      const baseDelay = Math.min(12_000, 1_000 * Math.pow(2, Math.min(reconnectAttempt, 4)));
      const jitter = Math.floor(Math.random() * 500);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!closed) {
          connectSocket();
        }
      }, baseDelay + jitter);
    };

    const connectSocket = () => {
      if (closed) return;
      clearReconnectTimer();

      let ws: WebSocket;
      try {
        ws = new WebSocket(getBattleRoomWsUrl());
        currentWs = ws;
        wsRef.current = ws;
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (closed || currentWs !== ws) return;
        reconnectAttempt = 0;
        setIsConnected(true);
        startHeartbeat(ws);

        if (mode === "spectator") {
          const spectateMsg: BattleRoomClientMessage = {
            type: "spectate_room",
            roomId,
          };
          ws.send(JSON.stringify(spectateMsg));
        } else {
          const joinMsg: BattleRoomClientMessage = {
            type: "join_room",
            roomId,
            tournamentId,
            user: userRef.current,
            rules: rulesRef.current,
          };
          ws.send(JSON.stringify(joinMsg));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as BattleRoomServerMessage;

          // Process pong regardless of roomId scoping
          if (msg.type === "pong") {
            const rtt = Math.max(1, Date.now() - msg.clientTimestamp);
            setLatencyMs(rtt);
            setConnectionHealth(rtt >= 280 ? "degraded" : "connected");
            lastPongReceived = Date.now();
            return;
          }

          if (msg.roomId !== roomId) return;
          lastPongReceived = Date.now();

          switch (msg.type) {
            case "room_snapshot": {
              setConnectionHealth((prev) => (prev === "degraded" ? "degraded" : "connected"));
              setParticipants(msg.participants);
              if (msg.rules) setRoomRules(msg.rules);
              if (msg.isStarting) setIsStarting(true);
              if (msg.spectatorCount != null) setSpectatorCount(msg.spectatorCount);
              if (msg.participants.length > 0) {
                const initPoint: { timestamp: number; [key: string]: number } = { timestamp: Date.now() };
                for (const p of msg.participants) {
                  initPoint[p.displayName || p.userId] = p.currentProfitPct;
                }
                setEquityHistory([initPoint]);
              }
              if (msg.matchStartedAt && msg.matchEndsAt) {
                setMatchTiming({
                  matchStartedAt: msg.matchStartedAt,
                  matchEndsAt: msg.matchEndsAt,
                  durationSeconds: msg.durationSeconds,
                });
                const remaining = Math.max(0, Math.round((msg.matchEndsAt - Date.now()) / 1000));
                setMatchSecondsRemaining(remaining);
                if (remaining === 0) setIsMatchExpired(true);
              }
              // Transmit any offline-queued actions
              flushPendingActions(ws);
              break;
            }

            case "spectator_count_update":
              setSpectatorCount(msg.spectatorCount);
              break;

            case "participant_joined":
              setParticipants((prev) => {
                if (prev.some((p) => p.userId === msg.participant.userId)) return prev;
                return [...prev, msg.participant];
              });
              break;

            case "participant_left":
              setParticipants((prev) => prev.filter((p) => p.userId !== msg.userId));
              break;

            case "ready_status_changed":
              setParticipants((prev) =>
                prev.map((p) => (p.userId === msg.userId ? { ...p, isReady: msg.isReady } : p)),
              );
              break;

            case "battle_countdown":
              setIsStarting(true);
              setCountdown(msg.secondsLeft);
              synestheticArenaCountdown(msg.secondsLeft);
              break;

            case "battle_launched":
              setIsStarting(false);
              setCountdown(null);
              synestheticArenaLaunch();
              setMatchTiming({
                matchStartedAt: msg.matchStartedAt,
                matchEndsAt: msg.matchEndsAt,
                durationSeconds: msg.durationSeconds,
              });
              setMatchSecondsRemaining(msg.durationSeconds);
              setIsMatchExpired(false);
              onBattleLaunchedRef.current?.(msg.assignments);
              break;

            case "match_time_tick":
              setMatchSecondsRemaining(msg.secondsRemaining);
              if (msg.secondsRemaining <= 0) {
                setIsMatchExpired(true);
                onMatchExpiredRef.current?.();
              }
              break;

            case "match_time_expired":
              setMatchSecondsRemaining(0);
              setIsMatchExpired(true);
              onMatchExpiredRef.current?.();
              break;

            case "telemetry_tick": {
              setParticipants(msg.participants);
              if (msg.participants.length > 0) {
                setEquityHistory((prev) => {
                  const pt: { timestamp: number; [key: string]: number } = { timestamp: Date.now() };
                  for (const p of msg.participants) {
                    pt[p.displayName || p.userId] = p.currentProfitPct;
                  }
                  return [...prev.slice(-49), pt];
                });
              }
              break;
            }

            case "trade_broadcast": {
              setRecentTrades((prev) => [msg.trade, ...prev.slice(0, 14)]);
              const isSelfTrade = Boolean(userRef.current?.userId && msg.trade.userId === userRef.current.userId);
              const pnl = msg.trade.pnl ?? 0;
              if (pnl > 0) {
                synestheticArenaTradeWin(isSelfTrade);
              } else if (pnl < 0) {
                synestheticArenaTradeLoss(isSelfTrade);
              }
              break;
            }

            case "participant_disqualified":
              synestheticArenaDisqualification();
              setLastDisqualification({
                displayName: msg.displayName,
                reason: msg.reason,
              });
              setParticipants((prev) =>
                prev.map((p) => (p.userId === msg.userId ? { ...p, status: "disqualified" } : p)),
              );
              break;

            case "stoic_sentence_broadcast":
              setRecentSentences((prev) => [
                { sender: msg.sender, sentence: msg.sentence, timestamp: msg.timestamp },
                ...prev.slice(0, 9),
              ]);
              break;

            default:
              break;
          }
        } catch {
          // ignore malformed payloads
        }
      };

      ws.onclose = () => {
        if (currentWs !== ws) return;
        setIsConnected(false);
        stopHeartbeat();
        if (!closed) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (currentWs !== ws) return;
        setConnectionHealth("degraded");
      };
    };

    const handleReconnectNow = () => {
      if (closed) return;
      if (
        !currentWs ||
        currentWs.readyState === WebSocket.CLOSED ||
        currentWs.readyState === WebSocket.CLOSING
      ) {
        reconnectAttempt = 0;
        connectSocket();
      }
    };

    reconnectNowRef.current = handleReconnectNow;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleReconnectNow();
      }
    };

    connectSocket();
    window.addEventListener("online", handleReconnectNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      closed = true;
      clearReconnectTimer();
      stopHeartbeat();
      window.removeEventListener("online", handleReconnectNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (currentWs) {
        if (currentWs.readyState === WebSocket.OPEN) {
          try {
            if (mode === "spectator") {
              currentWs.send(JSON.stringify({ type: "leave_spectate", roomId }));
            } else {
              currentWs.send(JSON.stringify({ type: "leave_room", roomId }));
            }
          } catch {
            // ignore
          }
        }
        currentWs.close();
      }
      wsRef.current = null;
    };
  }, [roomId, tournamentId, enabled, mode]);

  const sendTrade = useCallback(
    (trade: Omit<RoomTradeBroadcast, "id">) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "trade_executed",
          roomId,
          trade,
        };
        wsRef.current.send(JSON.stringify(msg));
      } else {
        // Buffer trade resiliently
        pendingActionsRef.current = [
          ...pendingActionsRef.current.slice(-19),
          { type: "trade", payload: trade },
        ];
        setPendingActionsCount(pendingActionsRef.current.length);
      }
    },
    [roomId],
  );

  const sendTelemetry = useCallback(
    (telemetry: {
      profitPct: number;
      drawdownPct: number;
      tradesCount: number;
      biometricBpm?: number;
      biometricShareConsent?: boolean;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "telemetry_update",
          roomId,
          ...telemetry,
        };
        wsRef.current.send(JSON.stringify(msg));
      } else {
        // Telemetry is latest-wins: replace previous telemetry or add
        const filtered = pendingActionsRef.current.filter((a) => a.type !== "telemetry");
        pendingActionsRef.current = [...filtered, { type: "telemetry", payload: telemetry }];
        setPendingActionsCount(pendingActionsRef.current.length);
      }
    },
    [roomId],
  );

  const sendStoicSentence = useCallback(
    (sentence: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "send_stoic_sentence",
          roomId,
          sentence,
        };
        wsRef.current.send(JSON.stringify(msg));
      } else {
        pendingActionsRef.current = [
          ...pendingActionsRef.current.slice(-19),
          { type: "sentence", payload: sentence },
        ];
        setPendingActionsCount(pendingActionsRef.current.length);
      }
    },
    [roomId],
  );

  const setReady = useCallback(
    (isReady: boolean) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "set_ready_status",
          roomId,
          isReady,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    [roomId],
  );

  const startBattle = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: BattleRoomClientMessage = {
        type: "start_battle_request",
        roomId,
      };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, [roomId]);

  const sendLobbyInvite = useCallback(
    (targetUserId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "send_lobby_invite",
          roomId,
          targetUserId,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    [roomId],
  );

  const reconnectNow = useCallback(() => {
    reconnectNowRef.current();
  }, []);

  return {
    isConnected,
    connectionHealth,
    latencyMs,
    pendingActionsCount,
    participants,
    roomRules,
    countdown,
    isStarting,
    matchSecondsRemaining,
    isMatchExpired,
    matchTiming,
    recentTrades,
    recentSentences,
    lastDisqualification,
    spectatorCount,
    equityHistory,
    sendTrade,
    sendTelemetry,
    sendStoicSentence,
    sendLobbyInvite,
    setReady,
    startBattle,
    reconnectNow,
  };
}
