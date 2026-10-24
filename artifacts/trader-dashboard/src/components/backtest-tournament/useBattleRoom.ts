import { useEffect, useRef, useState, useCallback } from "react";
import type {
  RoomParticipant,
  RoomTradeBroadcast,
  BattleRoomClientMessage,
  BattleRoomServerMessage,
  RoomLobbyRules,
} from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";

function getBattleRoomWsUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  const url = new URL("/api/backtest/battle-rooms/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export interface UseBattleRoomOptions {
  roomId: string;
  tournamentId: number;
  user?: Partial<RoomParticipant>;
  rules?: Partial<RoomLobbyRules>;
  enabled?: boolean;
  onBattleLaunched?: (assignments: Record<string, { startCandleTs: number; sessionId?: number }>) => void;
  onMatchExpired?: () => void;
}

export function useBattleRoom({
  roomId,
  tournamentId,
  user,
  rules,
  enabled = true,
  onBattleLaunched,
  onMatchExpired,
}: UseBattleRoomOptions) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [roomRules, setRoomRules] = useState<RoomLobbyRules | null>(null);
  const [recentTrades, setRecentTrades] = useState<RoomTradeBroadcast[]>([]);
  const [recentSentences, setRecentSentences] = useState<
    Array<{ sender: string; sentence: string; timestamp: number }>
  >([]);
  const [isConnected, setIsConnected] = useState(false);
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
  const onBattleLaunchedRef = useRef(onBattleLaunched);
  onBattleLaunchedRef.current = onBattleLaunched;
  const onMatchExpiredRef = useRef(onMatchExpired);
  onMatchExpiredRef.current = onMatchExpired;

  useEffect(() => {
    if (!enabled || !roomId) return;

    let closed = false;
    let ws: WebSocket;

    try {
      ws = new WebSocket(getBattleRoomWsUrl());
      wsRef.current = ws;
    } catch {
      return;
    }

    ws.onopen = () => {
      if (closed) return;
      setIsConnected(true);
      const joinMsg: BattleRoomClientMessage = {
        type: "join_room",
        roomId,
        tournamentId,
        user,
        rules,
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as BattleRoomServerMessage;
        if (msg.roomId !== roomId) return;

        switch (msg.type) {
          case "room_snapshot":
            setParticipants(msg.participants);
            if (msg.rules) setRoomRules(msg.rules);
            if (msg.isStarting) setIsStarting(true);
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
            break;

          case "battle_launched":
            setIsStarting(false);
            setCountdown(null);
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

          case "telemetry_tick":
            setParticipants(msg.participants);
            break;

          case "trade_broadcast":
            setRecentTrades((prev) => [msg.trade, ...prev.slice(0, 14)]);
            break;

          case "participant_disqualified":
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
      setIsConnected(false);
    };

    return () => {
      closed = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_room", roomId }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, tournamentId, enabled]);

  const sendTrade = useCallback(
    (trade: Omit<RoomTradeBroadcast, "id">) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "trade_executed",
          roomId,
          trade,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    [roomId],
  );

  const sendTelemetry = useCallback(
    (telemetry: { profitPct: number; drawdownPct: number; tradesCount: number }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: BattleRoomClientMessage = {
          type: "telemetry_update",
          roomId,
          ...telemetry,
        };
        wsRef.current.send(JSON.stringify(msg));
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

  return {
    isConnected,
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
    sendTrade,
    sendTelemetry,
    sendStoicSentence,
    sendLobbyInvite,
    setReady,
    startBattle,
  };
}
