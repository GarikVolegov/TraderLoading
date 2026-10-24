// ─── Battle Room Types (Prove del Fuoco · Limen Protocol) ───────────────────

export interface RoomParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  country: string;
  gradeTitle: string; // es. "Custode della Regola", "Alchimista delle Probabilità"
  tribeTag?: string; // es. "Spartan Gold", "Legione Forex"
  status: "ready" | "trading" | "finished" | "disqualified";
  isReady?: boolean;
  assignedStartTs?: number;
  sessionId?: number;
  currentProfitPct: number;
  currentDrawdownPct: number;
  tradesCount: number;
  lastActiveTs: number;
  isGhost?: boolean;
}

export interface RoomTradeBroadcast {
  id: string;
  userId: string;
  displayName: string;
  type: "BUY" | "SELL";
  price: number;
  pnl?: number;
  isClose?: boolean;
  timestamp: number;
}

export interface RoomLobbyRules {
  title: string;
  pair: string;
  timeframe: string;
  initialBalance: number;
  maxDrawdownPct: number;
  targetProfitPct: number;
  maxTrades: number;
  timeLimitSeconds: number;
  randomDates: boolean;
  hostUserId: string;
  tribePresetName?: string;
}

export type BattleRoomClientMessage =
  | {
      type: "join_room";
      roomId: string;
      tournamentId: number;
      user?: Partial<RoomParticipant>;
      rules?: Partial<RoomLobbyRules>;
    }
  | {
      type: "set_ready_status";
      roomId: string;
      isReady: boolean;
    }
  | {
      type: "start_battle_request";
      roomId: string;
    }
  | {
      type: "leave_room";
      roomId: string;
    }
  | {
      type: "trade_executed";
      roomId: string;
      trade: Omit<RoomTradeBroadcast, "id">;
    }
  | {
      type: "telemetry_update";
      roomId: string;
      profitPct: number;
      drawdownPct: number;
      tradesCount: number;
    }
  | {
      type: "finish_run";
      roomId: string;
      summary: {
        totalProfit: number;
        profitPct: number;
        maxDrawdown: number;
        winRate: number;
        totalTrades: number;
      };
    }
  | {
      type: "send_stoic_sentence";
      roomId: string;
      sentence: string;
    }
  | {
      type: "send_lobby_invite";
      roomId: string;
      targetUserId: string;
      targetName?: string;
    };

export type BattleRoomServerMessage =
  | {
      type: "room_snapshot";
      roomId: string;
      participants: RoomParticipant[];
      tournamentId: number;
      rules?: RoomLobbyRules;
      isStarting?: boolean;
      matchStartedAt?: number;
      matchEndsAt?: number;
      durationSeconds?: number;
    }
  | {
      type: "participant_joined";
      roomId: string;
      participant: RoomParticipant;
    }
  | {
      type: "participant_left";
      roomId: string;
      userId: string;
    }
  | {
      type: "ready_status_changed";
      roomId: string;
      userId: string;
      isReady: boolean;
    }
  | {
      type: "battle_countdown";
      roomId: string;
      secondsLeft: number;
    }
  | {
      type: "battle_launched";
      roomId: string;
      assignments: Record<string, { startCandleTs: number; sessionId?: number }>;
      matchStartedAt: number;
      matchEndsAt: number;
      durationSeconds: number;
    }
  | {
      type: "match_time_tick";
      roomId: string;
      secondsRemaining: number;
    }
  | {
      type: "match_time_expired";
      roomId: string;
    }
  | {
      type: "lobby_invitation_received";
      roomId: string;
      roomCode: string;
      senderName: string;
      pair: string;
      timeframe: string;
      durationMinutes: number;
    }
  | {
      type: "trade_broadcast";
      roomId: string;
      trade: RoomTradeBroadcast;
    }
  | {
      type: "telemetry_tick";
      roomId: string;
      participants: RoomParticipant[];
    }
  | {
      type: "participant_disqualified";
      roomId: string;
      userId: string;
      displayName: string;
      reason: string;
    }
  | {
      type: "stoic_sentence_broadcast";
      roomId: string;
      sender: string;
      sentence: string;
      timestamp: number;
    };
