import type {
  RoomParticipant,
  RoomTradeBroadcast,
  BattleRoomServerMessage,
  RoomLobbyRules,
} from "./battleRoomTypes.js";
import { SEED_COMMUNITY_ENTRIES } from "./store.js";
import { assignBlindHistoricalDates, getBlindHistoricalTimestamp } from "./blindDateEngine.js";
import {
  publishBattleRoomMessage,
  onBattleRoomMessage,
  closeBattleRoomPubSub,
} from "./battleEvents.js";

export interface BattleRoomState {
  id: string;
  tournamentId: number;
  rules?: RoomLobbyRules;
  isStarting?: boolean;
  matchStartedAt?: number;
  matchEndsAt?: number;
  durationSeconds?: number;
  timerInterval?: NodeJS.Timeout;
  telemetryFlushTimer?: NodeJS.Timeout;
  lastTelemetryBroadcastAt?: number;
  participants: Map<string, RoomParticipant>;
  subscribers: Set<(msg: BattleRoomServerMessage, preSerialized?: string) => void>;
  spectators: Set<string>;
  createdAt: number;
}

export interface BattleInvitePayload {
  roomId: string;
  roomCode: string;
  senderName: string;
  targetUserId: string;
  pair: string;
  timeframe: string;
  durationMinutes: number;
}

export type BattleInviteListener = (invite: BattleInvitePayload) => void | Promise<void>;

class BattleRoomManager {
  private rooms = new Map<string, BattleRoomState>();
  private sweepTimer?: NodeJS.Timeout;
  private unsubscribeBus?: () => void;
  private inviteListeners = new Set<BattleInviteListener>();

  constructor() {
    this.sweepTimer = setInterval(() => {
      this.pruneInactiveRooms();
    }, 300_000);
    if (typeof this.sweepTimer.unref === "function") {
      this.sweepTimer.unref();
    }
    this.unsubscribeBus = onBattleRoomMessage((roomId, msg) => {
      this.broadcastLocal(roomId, msg);
    });
  }

  /**
   * Sweeps rooms that finished or were abandoned with no subscribers,
   * clearing their ticker intervals to prevent memory and handle leaks.
   */
  public pruneInactiveRooms(now = Date.now()): number {
    let pruned = 0;
    for (const [roomId, room] of this.rooms.entries()) {
      const matchExpired = room.matchEndsAt && now > room.matchEndsAt + 15 * 60 * 1000;
      const roomStale = now - room.createdAt > 4 * 3600 * 1000;
      const hasHumanSubscribers = room.subscribers.size > 0 || (room.spectators && room.spectators.size > 0);
      const hasHumanParticipants = Array.from(room.participants.values()).some((p) => !p.isGhost);

      if ((matchExpired || roomStale) && !hasHumanSubscribers && !hasHumanParticipants) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        if (room.telemetryFlushTimer) clearTimeout(room.telemetryFlushTimer);
        this.rooms.delete(roomId);
        pruned++;
      }
    }
    return pruned;
  }

  public async stop() {
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = undefined;
    }
    await closeBattleRoomPubSub();
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    for (const room of this.rooms.values()) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      if (room.telemetryFlushTimer) clearTimeout(room.telemetryFlushTimer);
    }
    this.rooms.clear();
    this.inviteListeners.clear();
  }

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
      if (this.rooms.size >= 1000) {
        this.pruneInactiveRooms();
        if (this.rooms.size >= 1000) {
          for (const [candidateId, candidate] of this.rooms.entries()) {
            const hasHumans =
              candidate.subscribers.size > 0 ||
              candidate.spectators.size > 0 ||
              Array.from(candidate.participants.values()).some((p) => !p.isGhost);
            if (!hasHumans) {
              if (candidate.timerInterval) clearInterval(candidate.timerInterval);
              if (candidate.telemetryFlushTimer) clearTimeout(candidate.telemetryFlushTimer);
              this.rooms.delete(candidateId);
              break;
            }
          }
        }
      }
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
        spectators: new Set(),
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

  public subscribe(
    roomId: string,
    listener: (msg: BattleRoomServerMessage, preSerialized?: string) => void,
  ): () => void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.subscribers.add(listener);
    }
    return () => {
      const current = this.rooms.get(roomId);
      if (current) {
        current.subscribers.delete(listener);
        const hasHumanParticipants = Array.from(current.participants.values()).some(
          (p) => !p.isGhost,
        );
        if (
          current.subscribers.size === 0 &&
          current.spectators.size === 0 &&
          !hasHumanParticipants
        ) {
          if (current.timerInterval) clearInterval(current.timerInterval);
          if (current.telemetryFlushTimer) clearTimeout(current.telemetryFlushTimer);
          this.rooms.delete(roomId);
        }
      }
    };
  }

  private broadcastLocal(roomId: string, msg: BattleRoomServerMessage) {
    const room = this.rooms.get(roomId);
    if (!room || room.subscribers.size === 0) return;
    const preSerialized = JSON.stringify(msg);
    for (const listener of room.subscribers) {
      try {
        listener(msg, preSerialized);
      } catch {
        // Drop failed subscriber
      }
    }
  }

  public broadcast(roomId: string, msg: BattleRoomServerMessage) {
    this.broadcastLocal(roomId, msg);
    publishBattleRoomMessage(roomId, msg);
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
      gradeTitle: user.gradeTitle || "Iniziato AUREUS",
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
    if (!room || room.isStarting) return {};

    room.isStarting = true;
    try {

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

    return assignments;
    } finally {
      room.isStarting = false;
    }
  }

  public onInvite(listener: BattleInviteListener): () => void {
    this.inviteListeners.add(listener);
    return () => {
      this.inviteListeners.delete(listener);
    };
  }

  public sendInvite(roomId: string, senderName: string, targetUserId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const roomCode = roomId.replace(/^custom_forgia_/, "");
    const pair = room.rules?.pair || "XAU/USD";
    const timeframe = room.rules?.timeframe || "M5";
    const durationMinutes = Math.round((room.rules?.timeLimitSeconds || 900) / 60);

    const invitePayload: BattleInvitePayload = {
      roomId,
      roomCode,
      senderName,
      targetUserId,
      pair,
      timeframe,
      durationMinutes,
    };

    this.broadcast(roomId, {
      type: "lobby_invitation_received",
      roomId,
      roomCode,
      senderName,
      pair,
      timeframe,
      durationMinutes,
    });

    for (const listener of this.inviteListeners) {
      try {
        const result = listener(invitePayload);
        if (result && typeof (result as any).catch === "function") {
          (result as Promise<void>).catch(() => {
            // Handled inside listener
          });
        }
      } catch {
        // Listener safety guard
      }
    }
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

    const hasHumanParticipants = Array.from(room.participants.values()).some((p) => !p.isGhost);
    if (room.subscribers.size === 0 && !hasHumanParticipants) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      this.rooms.delete(roomId);
    }
  }

  public updateTelemetry(
    roomId: string,
    userId: string,
    data: {
      profitPct: number;
      drawdownPct: number;
      tradesCount: number;
      biometricBpm?: number;
      /** Consenso esplicito e separato (GDPR art. 9). Senza `true` il BPM è scartato. */
      biometricShareConsent?: boolean;
    },
  ) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const p = room.participants.get(userId);
    if (!p) return;

    p.currentProfitPct = data.profitPct;
    p.currentDrawdownPct = data.drawdownPct;
    p.tradesCount = data.tradesCount;
    p.lastActiveTs = Date.now();

    if (data.biometricShareConsent !== true) {
      // Revoca/assenza di consenso: nessun dato biometrico resta in stanza.
      delete p.biometricBpm;
      delete p.stressLevel;
    } else if (
      typeof data.biometricBpm === "number" &&
      Number.isFinite(data.biometricBpm) &&
      data.biometricBpm >= 30 &&
      data.biometricBpm <= 230
    ) {
      p.biometricBpm = data.biometricBpm;
      p.stressLevel =
        data.biometricBpm >= 95
          ? "critical"
          : data.biometricBpm >= 80
          ? "elevated"
          : "calm";
    }

    // Check room drawdown limit (defaults to 10%)
    const maxDdLimit = room.rules?.maxDrawdownPct ?? 10.0;
    if (data.drawdownPct >= maxDdLimit && p.status !== "disqualified") {
      p.status = "disqualified";
      this.broadcast(roomId, {
        type: "participant_disqualified",
        roomId,
        userId,
        displayName: p.displayName,
        reason: `Violazione Limite di Rischio: Max Drawdown ${maxDdLimit}% superato`,
      });
    }

    // Coalesce high-frequency telemetry ticks per room (leading edge + 100ms trailing window)
    const now = Date.now();
    const elapsed = now - (room.lastTelemetryBroadcastAt ?? 0);
    if (elapsed >= 100) {
      if (room.telemetryFlushTimer) {
        clearTimeout(room.telemetryFlushTimer);
        room.telemetryFlushTimer = undefined;
      }
      room.lastTelemetryBroadcastAt = now;
      this.broadcast(roomId, {
        type: "telemetry_tick",
        roomId,
        participants: Array.from(room.participants.values()),
      });
    } else if (!room.telemetryFlushTimer) {
      const waitMs = Math.max(10, 100 - elapsed);
      const flushTimer = setTimeout(() => {
        room.telemetryFlushTimer = undefined;
        const current = this.rooms.get(roomId);
        if (!current) return;
        current.lastTelemetryBroadcastAt = Date.now();
        this.broadcast(roomId, {
          type: "telemetry_tick",
          roomId,
          participants: Array.from(current.participants.values()),
        });
      }, waitMs);
      if (typeof flushTimer.unref === "function") {
        flushTimer.unref();
      }
      room.telemetryFlushTimer = flushTimer;
    }
  }

  public touchParticipant(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const p = room.participants.get(userId);
    if (p) {
      p.lastActiveTs = Date.now();
    }
  }

  public recordTrade(roomId: string, trade: Omit<RoomTradeBroadcast, "id">) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const p = room.participants.get(trade.userId);
    if (p) {
      p.lastActiveTs = Date.now();
      p.tradesCount += 1;
    }

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
    const room = this.rooms.get(roomId);
    if (room) {
      const p = Array.from(room.participants.values()).find((x) => x.displayName === sender);
      if (p) {
        p.lastActiveTs = Date.now();
      }
    }

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
    spectatorCount?: number;
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
      spectatorCount: room.spectators?.size ?? 0,
    };
  }

  public spectateRoom(
    roomId: string,
    spectatorId: string,
  ): {
    snapshot: ReturnType<BattleRoomManager["getRoomSnapshotData"]>;
    spectatorCount: number;
  } {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.getOrCreateRoom(roomId, 1);
    }
    if (!room.spectators) {
      room.spectators = new Set();
    }
    room.spectators.add(spectatorId);
    const count = room.spectators.size;

    this.broadcast(roomId, {
      type: "spectator_count_update",
      roomId,
      spectatorCount: count,
    });

    return {
      snapshot: this.getRoomSnapshotData(roomId),
      spectatorCount: count,
    };
  }

  public getRoomSpectatorCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room?.spectators ? room.spectators.size : 0;
  }

  public leaveSpectate(roomId: string, spectatorId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.spectators) return;
    if (room.spectators.delete(spectatorId)) {
      this.broadcast(roomId, {
        type: "spectator_count_update",
        roomId,
        spectatorCount: room.spectators.size,
      });
      const hasHumanParticipants = Array.from(room.participants.values()).some((p) => !p.isGhost);
      if (room.subscribers.size === 0 && room.spectators.size === 0 && !hasHumanParticipants) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        if (room.telemetryFlushTimer) clearTimeout(room.telemetryFlushTimer);
        this.rooms.delete(roomId);
      }
    }
  }

  /**
   * Reset for test suites
   */
  public resetForTesting() {
    for (const room of this.rooms.values()) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      if (room.telemetryFlushTimer) clearTimeout(room.telemetryFlushTimer);
    }
    this.rooms.clear();
    this.inviteListeners.clear();
  }
}

export const battleRoomManager = new BattleRoomManager();
