import type {
  RoomParticipant,
  RoomTradeBroadcast,
  BattleRoomServerMessage,
  RoomLobbyRules,
} from "./battleRoomTypes.js";
import { SEED_COMMUNITY_ENTRIES } from "./store.js";
import { assignBlindHistoricalDates, getBlindHistoricalTimestamp } from "./blindDateEngine.js";

export interface BattleRoomState {
  id: string;
  tournamentId: number;
  rules?: RoomLobbyRules;
  isStarting?: boolean;
  matchStartedAt?: number;
  matchEndsAt?: number;
  durationSeconds?: number;
  timerInterval?: NodeJS.Timeout;
  participants: Map<string, RoomParticipant>;
  subscribers: Set<(msg: BattleRoomServerMessage) => void>;
  createdAt: number;
}

class BattleRoomManager {
  private rooms = new Map<string, BattleRoomState>();

  /**
   * Get or initialize a battle room.
   * If newly created and not a custom room, seeds realistic active ghost traders based on the community leaderboard.
   */
  public getOrCreateRoom(
    roomId: string,
    tournamentId: number,
    rules?: Partial<RoomLobbyRules>,
  ): BattleRoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      const isCustom = roomId.startsWith("custom_");
      room = {
        id: roomId,
        tournamentId,
        rules: rules
          ? {
              title: rules.title || "Forgia Personalizzata",
              pair: rules.pair || "XAU/USD",
              timeframe: rules.timeframe || "M5",
              initialBalance: rules.initialBalance || 100000,
              maxDrawdownPct: rules.maxDrawdownPct || 10.0,
              targetProfitPct: rules.targetProfitPct || 15.0,
              maxTrades: rules.maxTrades || 50,
              timeLimitSeconds: rules.timeLimitSeconds || 900,
              randomDates: rules.randomDates ?? true,
              hostUserId: rules.hostUserId || "",
              tribePresetName: rules.tribePresetName,
            }
          : undefined,
        participants: new Map(),
        subscribers: new Set(),
        createdAt: Date.now(),
      };

      // Only seed ghosts for public tournament queues, never for private custom lobbies
      if (!isCustom) {
        const ghosts = SEED_COMMUNITY_ENTRIES.slice(0, 4);
        for (const [idx, g] of ghosts.entries()) {
          const ghostId = `ghost_${g.displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${idx}`;
          const p: RoomParticipant = {
            userId: ghostId,
            displayName: g.displayName,
            avatarUrl: g.avatarUrl,
            country: g.country,
            gradeTitle: idx === 0 ? "Maestro Supremo" : idx === 1 ? "Alchimista delle Probabilità" : "Custode della Regola",
            status: "trading",
            isReady: true,
            currentProfitPct: Number(g.profitPct),
            currentDrawdownPct: Math.min(Number(g.maxDrawdown), 8.5),
            tradesCount: Math.max(g.totalTrades, 2),
            lastActiveTs: Date.now() - Math.floor(Math.random() * 60000),
            isGhost: true,
          };
          room.participants.set(ghostId, p);
        }
      }

      this.rooms.set(roomId, room);
    } else if (rules) {
      // Merge rules if provided
      room.rules = {
        ...(room.rules || {
          title: "Forgia Personalizzata",
          pair: "XAU/USD",
          timeframe: "M5",
          initialBalance: 100000,
          maxDrawdownPct: 10.0,
          targetProfitPct: 15.0,
          maxTrades: 50,
          timeLimitSeconds: 900,
          randomDates: true,
          hostUserId: "",
        }),
        ...rules,
      };
    }
    return room;
  }

  public subscribe(roomId: string, listener: (msg: BattleRoomServerMessage) => void): () => void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.subscribers.add(listener);
    }
    return () => {
      const current = this.rooms.get(roomId);
      if (current) {
        current.subscribers.delete(listener);
        if (current.subscribers.size === 0 && current.participants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    };
  }

  public broadcast(roomId: string, msg: BattleRoomServerMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const listener of room.subscribers) {
      try {
        listener(msg);
      } catch {
        // Drop failed subscriber
      }
    }
  }

  public joinRoom(
    roomId: string,
    tournamentId: number,
    user: Partial<RoomParticipant> & { userId: string; displayName: string },
    rules?: Partial<RoomLobbyRules>,
  ): BattleRoomState {
    const room = this.getOrCreateRoom(roomId, tournamentId, rules);

    const participant: RoomParticipant = {
      userId: user.userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      country: user.country || "IT",
      gradeTitle: user.gradeTitle || "Iniziato di Limen",
      tribeTag: user.tribeTag,
      status: "ready",
      isReady: user.isReady ?? false,
      currentProfitPct: user.currentProfitPct ?? 0,
      currentDrawdownPct: user.currentDrawdownPct ?? 0,
      tradesCount: user.tradesCount ?? 0,
      lastActiveTs: Date.now(),
      isGhost: false,
    };

    // If host is not set yet on custom room, assign the first joiner as host
    if (room.rules && !room.rules.hostUserId) {
      room.rules.hostUserId = user.userId;
    }

    room.participants.set(user.userId, participant);

    this.broadcast(roomId, {
      type: "participant_joined",
      roomId,
      participant,
    });

    return room;
  }

  public setReady(roomId: string, userId: string, isReady: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const p = room.participants.get(userId);
    if (p) {
      p.isReady = isReady;
      this.broadcast(roomId, {
        type: "ready_status_changed",
        roomId,
        userId,
        isReady,
      });

      this.broadcast(roomId, {
        type: "telemetry_tick",
        roomId,
        participants: Array.from(room.participants.values()),
      });
    }
  }

  /**
   * Starts the battle with countdown and generates unique blind historical timestamps for each participant!
   */
  public async startBattle(roomId: string): Promise<Record<string, { startCandleTs: number }>> {
    const room = this.rooms.get(roomId);
    if (!room) return {};

    room.isStarting = true;

    // Countdown 3s
    for (let sec = 3; sec > 0; sec--) {
      this.broadcast(roomId, {
        type: "battle_countdown",
        roomId,
        secondsLeft: sec,
      });
      await new Promise((r) => setTimeout(r, 900));
    }

    const pair = room.rules?.pair || "XAU/USD";
    const timeframe = room.rules?.timeframe || "M5";
    const isRandomDates = room.rules?.randomDates ?? true;

    const participantIds = Array.from(room.participants.keys());
    const assignments: Record<string, { startCandleTs: number }> = {};

    if (isRandomDates) {
      // Blind mode: everyone gets a distinct random historical timestamp
      const timestamps = await assignBlindHistoricalDates(participantIds, pair, timeframe);
      for (const [pid, ts] of Object.entries(timestamps)) {
        assignments[pid] = { startCandleTs: ts };
        const p = room.participants.get(pid);
        if (p) {
          p.assignedStartTs = ts;
          p.status = "trading";
        }
      }
    } else {
      // Identical fixed date for classic direct confrontation
      const singleTs = await getBlindHistoricalTimestamp(pair, timeframe);
      for (const pid of participantIds) {
        assignments[pid] = { startCandleTs: singleTs };
        const p = room.participants.get(pid);
        if (p) {
          p.assignedStartTs = singleTs;
          p.status = "trading";
        }
      }
    }

    const durationSeconds = room.rules?.timeLimitSeconds || 900;
    const matchStartedAt = Date.now();
    const matchEndsAt = matchStartedAt + durationSeconds * 1000;
    room.matchStartedAt = matchStartedAt;
    room.matchEndsAt = matchEndsAt;
    room.durationSeconds = durationSeconds;

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
    }

    // Set up live countdown ticker
    const timer = setInterval(() => {
      const remainingSec = Math.max(0, Math.floor((matchEndsAt - Date.now()) / 1000));
      this.broadcast(roomId, {
        type: "match_time_tick",
        roomId,
        secondsRemaining: remainingSec,
      });

      if (remainingSec <= 0) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        this.broadcast(roomId, {
          type: "match_time_expired",
          roomId,
        });
      }
    }, 1000);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    room.timerInterval = timer;

    this.broadcast(roomId, {
      type: "battle_launched",
      roomId,
      assignments,
      matchStartedAt,
      matchEndsAt,
      durationSeconds,
    });

    room.isStarting = false;
    return assignments;
  }

  public sendInvite(roomId: string, senderName: string, targetUserId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const roomCode = roomId.replace(/^custom_forgia_/, "");
    const pair = room.rules?.pair || "XAU/USD";
    const timeframe = room.rules?.timeframe || "M5";
    const durationMinutes = Math.round((room.rules?.timeLimitSeconds || 900) / 60);

    this.broadcast(roomId, {
      type: "lobby_invitation_received",
      roomId,
      roomCode,
      senderName,
      pair,
      timeframe,
      durationMinutes,
    });
  }

  public leaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.participants.has(userId)) {
      room.participants.delete(userId);
      this.broadcast(roomId, {
        type: "participant_left",
        roomId,
        userId,
      });
    }
  }

  public updateTelemetry(
    roomId: string,
    userId: string,
    data: { profitPct: number; drawdownPct: number; tradesCount: number },
  ) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const p = room.participants.get(userId);
    if (!p) return;

    p.currentProfitPct = data.profitPct;
    p.currentDrawdownPct = data.drawdownPct;
    p.tradesCount = data.tradesCount;
    p.lastActiveTs = Date.now();

    // Check 10% DD limit
    if (data.drawdownPct >= 10.0 && p.status !== "disqualified") {
      p.status = "disqualified";
      this.broadcast(roomId, {
        type: "participant_disqualified",
        roomId,
        userId,
        displayName: p.displayName,
        reason: "Violazione Limite di Rischio: Max Drawdown 10% superato",
      });
    }

    this.broadcast(roomId, {
      type: "telemetry_tick",
      roomId,
      participants: Array.from(room.participants.values()),
    });
  }

  public recordTrade(roomId: string, trade: Omit<RoomTradeBroadcast, "id">) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const broadcastTrade: RoomTradeBroadcast = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    this.broadcast(roomId, {
      type: "trade_broadcast",
      roomId,
      trade: broadcastTrade,
    });
  }

  public broadcastStoicSentence(roomId: string, sender: string, sentence: string) {
    this.broadcast(roomId, {
      type: "stoic_sentence_broadcast",
      roomId,
      sender,
      sentence,
      timestamp: Date.now(),
    });
  }

  public getSnapshot(roomId: string): RoomParticipant[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.participants.values());
  }

  public getRoomSnapshotData(roomId: string): {
    participants: RoomParticipant[];
    rules?: RoomLobbyRules;
    isStarting?: boolean;
    matchStartedAt?: number;
    matchEndsAt?: number;
    durationSeconds?: number;
  } {
    const room = this.rooms.get(roomId);
    if (!room) return { participants: [] };
    return {
      participants: Array.from(room.participants.values()),
      rules: room.rules,
      isStarting: room.isStarting,
      matchStartedAt: room.matchStartedAt,
      matchEndsAt: room.matchEndsAt,
      durationSeconds: room.durationSeconds,
    };
  }

  /**
   * Reset for test suites
   */
  public resetForTesting() {
    for (const room of this.rooms.values()) {
      if (room.timerInterval) clearInterval(room.timerInterval);
    }
    this.rooms.clear();
  }
}

export const battleRoomManager = new BattleRoomManager();
