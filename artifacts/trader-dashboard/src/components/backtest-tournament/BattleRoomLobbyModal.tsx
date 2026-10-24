import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Forgia3DArena } from "./Forgia3DArena";
import { useBattleRoom } from "./useBattleRoom";
import { BattleInviteModal } from "./BattleInviteModal";
import {
  Flame,
  Users,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Award,
  Shuffle,
  Play,
  Check,
  UserPlus,
  Clock,
} from "lucide-react";
import type { BacktestTournament, BacktestCustomLobby } from "@/lib/backtestTournamentsApi";
import { playBattleChime } from "@/lib/tournamentSoundEffects";

export interface BattleRoomLobbyModalProps {
  tournament?: BacktestTournament | null;
  customLobby?: BacktestCustomLobby | null;
  isOpen: boolean;
  onClose: () => void;
  onEnterBattle: (assignedStartTs?: number) => void;
  userDisplayName?: string;
  isJoining?: boolean;
}

export function BattleRoomLobbyModal({
  tournament,
  customLobby,
  isOpen,
  onClose,
  onEnterBattle,
  userDisplayName = "Tu",
  isJoining = false,
}: BattleRoomLobbyModalProps) {
  const [isReady, setIsReadyState] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const isCustom = Boolean(customLobby);
  const roomCode = customLobby?.code || `TOURN-${tournament?.id || 1}`;
  const roomId = isCustom
    ? `custom_forgia_${customLobby?.code || "room"}`
    : `room_tournament_${tournament?.id || 1}`;

  const tournamentId = tournament?.id || customLobby?.id || 1;

  const roomTitle = customLobby?.name || tournament?.title || "Prova del Fuoco";
  const pair = customLobby?.pair || tournament?.pair || "XAU/USD";
  const timeframe = customLobby?.timeframe || tournament?.timeframe || "M5";
  const maxDrawdownPct = customLobby?.maxDrawdownPct || tournament?.maxDrawdownPct || "10.00";
  const targetProfitPct = customLobby?.targetProfitPct || tournament?.targetProfitPct || "15.00";
  const maxTrades = customLobby?.maxTrades ?? tournament?.maxTrades ?? 50;
  const rawTimeLimit = customLobby ? customLobby.timeLimitSeconds : tournament?.timeLimitSeconds;
  const timeLimitMinutes = rawTimeLimit != null && rawTimeLimit > 0 ? Math.round(rawTimeLimit / 60) : 0;
  const isRandomDates = customLobby?.randomDates ?? true;
  const isHost =
    !isCustom ||
    !customLobby?.hostDisplayName ||
    customLobby.hostDisplayName === userDisplayName ||
    customLobby.hostDisplayName === "Comandante";

  const {
    participants,
    isConnected,
    countdown,
    isStarting,
    setReady,
    startBattle,
    sendLobbyInvite,
  } = useBattleRoom({
    roomId,
    tournamentId,
    user: {
      displayName: userDisplayName,
      country: "IT",
      gradeTitle: "Custode della Regola",
      isReady,
    },
    rules: {
      title: roomTitle,
      pair,
      timeframe,
      maxDrawdownPct: Number(maxDrawdownPct),
      targetProfitPct: Number(targetProfitPct),
      maxTrades,
      randomDates: isRandomDates,
      hostUserId: customLobby?.hostUserId,
    },
    enabled: isOpen,
    onBattleLaunched: (assignments) => {
      playBattleChime();
      const myAssignment = assignments[userDisplayName] || Object.values(assignments)[0];
      const startTs = myAssignment?.startCandleTs;
      onEnterBattle(startTs);
    },
  });

  const toggleReady = () => {
    const next = !isReady;
    setIsReadyState(next);
    setReady(next);
  };

  const handleHostStart = () => {
    playBattleChime();
    if (isConnected && participants.length > 1) {
      startBattle();
    } else {
      startBattle();
      onEnterBattle();
    }
  };

  const participants3d = participants.map((p) => ({
    displayName: p.displayName,
    profitPct: p.currentProfitPct,
    isDisqualified: p.status === "disqualified",
    isCurrentUser: p.displayName === userDisplayName,
  }));

  const readyCount = participants.filter((p) => p.isReady).length;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        className="max-w-2xl bg-[#0B0C10] border border-[#C5A059]/40 p-0 text-white overflow-hidden shadow-2xl"
      >
        <div className="p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#D4AF37] font-mono text-[9.5px] font-bold uppercase tracking-widest">
                  <Flame size={12} /> Stanza {roomCode}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isConnected ? "Sincronizzato Live" : "Connessione in corso…"}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
                {roomTitle}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsInviteOpen(true)}
                className="px-2.5 py-1.5 rounded bg-[#181922] border border-[#C5A059]/40 hover:bg-[#252634] font-mono text-xs text-[#D4AF37] font-semibold flex items-center gap-1.5 transition-all shadow"
                title="Invita altri concorrenti"
              >
                <UserPlus size={13} />
                <span>Invita</span>
              </button>
            </div>
          </div>

          {/* Dynamic Countdown Banner */}
          {countdown != null && (
            <div className="py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#C5A059]/20 via-[#D4AF37]/35 to-[#C5A059]/20 border border-[#D4AF37] text-center animate-pulse">
              <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest block">
                Lancio Sincronizzato in Corso
              </span>
              <span className="font-mono text-3xl font-extrabold text-white tracking-wider">
                {countdown}
              </span>
            </div>
          )}

          {/* 2-Column Split Stage: Left 3D + Rules, Right Live Participants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {/* Left: 3D Scene + Core Risk Directives */}
            <div className="space-y-2">
              <Forgia3DArena participants={participants3d} height={160} />

              <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-[#121318] border border-white/5 font-mono text-[10px]">
                <div className="flex items-center gap-1 text-[#CBD5E1]">
                  <CheckCircle2 size={11} className="text-[#D4AF37]" />
                  <span>{pair} · {timeframe}</span>
                </div>
                <div className="flex items-center gap-1 text-[#CBD5E1]">
                  <Clock size={11} className="text-[#38BDF8]" />
                  <span>
                    {timeLimitMinutes > 0 ? `${timeLimitMinutes} min durata` : "Senza Timer"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[#CBD5E1]">
                  <ShieldAlert size={11} className="text-[#F87171]" />
                  <span>Max DD: {maxDrawdownPct}%</span>
                </div>
                <div className="flex items-center gap-1 text-[#CBD5E1]">
                  <Shuffle size={11} className="text-[#34D399]" />
                  <span>{isRandomDates ? "Date Blind" : "Data Fissa"}</span>
                </div>
              </div>
            </div>

            {/* Right: Participants list with readiness */}
            <div className="space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] font-mono text-[#94A3B8] px-1 mb-1">
                  <span className="uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={12} /> Concorrenti ({readyCount}/{participants.length} Pronti)
                  </span>
                  <span className="text-[#D4AF37] font-semibold">{participants.length} Online</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {participants.map((p, idx) => (
                    <div
                      key={p.userId || idx}
                      className={`flex items-center justify-between p-2 rounded-md border text-xs transition-all ${
                        p.isReady
                          ? "bg-[#181A22] border-[#C5A059]/40 shadow-sm"
                          : "bg-[#14151C] border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#272732] border border-[#C5A059]/40 flex items-center justify-center font-mono text-[10px] text-[#D4AF37] font-bold">
                          {p.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white block leading-tight">
                            {p.displayName} {p.displayName === userDisplayName ? "(Tu)" : ""}
                          </span>
                          <span className="text-[9px] font-mono text-[#8E92A0]">
                            {p.gradeTitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        {p.isReady ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                            <Check size={10} className="stroke-[3]" /> Pronto
                          </span>
                        ) : (
                          <span className="text-[#71717A] text-[9.5px]">In Attesa</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(true)}
                  className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#C5A059] hover:underline"
                >
                  <UserPlus size={11} /> + Invita altri compagni
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-white/10">
            <button
              type="button"
              onClick={toggleReady}
              className={`px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                isReady
                  ? "bg-emerald-500/15 border-emerald-400 text-emerald-300 hover:bg-emerald-500/25 shadow"
                  : "bg-[#1E1F26] border-white/10 text-[#CBD5E1] hover:bg-[#2A2B35]"
              }`}
            >
              {isReady ? <Check size={13} className="stroke-[3]" /> : null}
              <span>{isReady ? "Sei Pronto" : "Dichiarati Pronto"}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#1E1F26] border border-white/10 text-xs font-semibold text-[#CBD5E1] hover:bg-[#2A2B35] transition-all"
              >
                Esci
              </button>

              {isHost ? (
                <button
                  type="button"
                  onClick={handleHostStart}
                  disabled={isStarting}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 shadow-lg transition-all"
                >
                  <Play size={13} className="fill-black" />
                  <span>{isStarting ? "Avvio in corso…" : "Avvia Battaglia"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onEnterBattle()}
                  disabled={isJoining || isStarting}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 shadow-lg transition-all"
                >
                  <span>{isJoining ? "Connessione…" : "Entra nella Forgia"}</span>
                  <ArrowRight size={13} className="stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Invito Dedicato */}
      <BattleInviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomCode={roomCode}
        roomId={roomId}
        onSendSocketInvite={sendLobbyInvite}
      />
    </>
  );
}
