import React, { useState, useEffect } from "react";
import {
  Users,
  Flame,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Clock,
  Heart,
  Eye,
  Watch,
  X,
} from "lucide-react";
import type { RoomParticipant, RoomTradeBroadcast } from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";
import type { ConnectionHealth } from "./useBattleRoom";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { SmartWatchConnectModal } from "@/components/biometrics/SmartWatchConnectModal";

export interface LiveBattleTelemetryHUDProps {
  participants: RoomParticipant[];
  recentTrades: RoomTradeBroadcast[];
  recentSentences: Array<{ sender: string; sentence: string; timestamp: number }>;
  userDrawdownPct: number;
  maxAllowedDrawdownPct: number;
  onSendSentence?: (sentence: string) => void;
  onClose?: () => void;
  isOpen: boolean;
  matchSecondsRemaining?: number | null;
  isMatchExpired?: boolean;
  connectionHealth?: ConnectionHealth;
  latencyMs?: number | null;
  pendingActionsCount?: number;
  onReconnect?: () => void;
  spectatorCount?: number;
  onOpenSpectatorShare?: () => void;
}

const STOIC_SENTENCES = [
  "Nessuna anticipazione",
  "Rispetta il piano chirurgico",
  "La disciplina precede il profitto",
  "Nessun cedimento emotivo",
  "Pazienza sulle conferme",
];

function formatTimeRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export type ParticipantPresenceStatus =
  | "active"
  | "reflecting"
  | "idle"
  | "finished"
  | "disqualified";

export interface ParticipantPresenceInfo {
  status: ParticipantPresenceStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
}

export function getParticipantPresence(
  p: RoomParticipant,
  now = Date.now(),
): ParticipantPresenceInfo {
  if (p.status === "disqualified") {
    return {
      status: "disqualified",
      label: "Squalificato",
      badgeClass: "bg-rose-500/15 border-rose-500/35 text-rose-400",
      dotClass: "bg-rose-500",
    };
  }

  if (p.status === "finished") {
    return {
      status: "finished",
      label: "Concluso",
      badgeClass: "bg-[#C5A059]/15 border-[#C5A059]/35 text-[#E8C56A]",
      dotClass: "bg-[#C5A059]",
    };
  }

  const deltaSeconds = Math.max(0, Math.floor((now - (p.lastActiveTs || now)) / 1000));

  if (deltaSeconds < 15) {
    return {
      status: "active",
      label: "Attivo ora",
      badgeClass: "bg-emerald-500/15 border-emerald-500/35 text-emerald-400",
      dotClass: "bg-emerald-400 animate-pulse",
    };
  }

  if (deltaSeconds < 60) {
    return {
      status: "reflecting",
      label: `In riflessione (${deltaSeconds}s)`,
      badgeClass: "bg-amber-500/15 border-amber-500/35 text-amber-300",
      dotClass: "bg-amber-400",
    };
  }

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  return {
    status: "idle",
    label: `Inattivo (${deltaMinutes}m)`,
    badgeClass: "bg-slate-500/15 border-slate-500/30 text-slate-400",
    dotClass: "bg-slate-500",
  };
}

export function LiveBattleTelemetryHUD({
  participants,
  recentTrades,
  recentSentences,
  userDrawdownPct,
  maxAllowedDrawdownPct,
  onSendSentence,
  onClose,
  isOpen,
  matchSecondsRemaining,
  isMatchExpired,
  connectionHealth,
  latencyMs,
  pendingActionsCount,
  onReconnect,
  spectatorCount,
  onOpenSpectatorShare,
}: LiveBattleTelemetryHUDProps) {
  const [activeTab, setActiveTab] = useState<"standings" | "feed" | "focus">("standings");
  const [now, setNow] = useState(() => Date.now());
  const [smartWatchModalOpen, setSmartWatchModalOpen] = useState(false);
  const watch = useSmartWatchHeartRate();

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(ticker);
  }, []);

  if (!isOpen) return null;

  const sortedParticipants = [...participants].sort(
    (a, b) => b.currentProfitPct - a.currentProfitPct,
  );

  const activeCount = participants.filter(
    (p) => p.status === "trading" && now - (p.lastActiveTs || now) < 30_000,
  ).length;

  const ddDanger = userDrawdownPct >= maxAllowedDrawdownPct * 0.8;

  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        right: 12,
        width: 320,
        maxHeight: "calc(100vh - 120px)",
        background: "rgba(12, 13, 17, 0.96)",
        border: "1px solid rgba(197, 160, 89, 0.35)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      className="text-white text-xs select-none"
    >
      <style>{`
        @keyframes btmHeartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.28); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#16171E]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Flame size={12} />
          </span>
          <div className="min-w-0">
            <h4 className="font-mono text-[10.5px] font-bold text-[#D4AF37] uppercase tracking-wider truncate">
              Telemetria Stanza Live
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9.5px] text-[#8E92A0] whitespace-nowrap inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <strong className="text-emerald-400">{activeCount}</strong>/{participants.length} Attivi
              </span>

              {connectionHealth && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border ${
                    connectionHealth === "connected"
                      ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                      : connectionHealth === "degraded"
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                      : "bg-rose-500/15 border-rose-500/35 text-rose-300"
                  }`}
                  title={
                    connectionHealth === "connected"
                      ? `Canale sincrono attivo (Latenza: ${latencyMs ?? "<50"}ms)`
                      : connectionHealth === "degraded"
                      ? `Latenza elevata (${latencyMs}ms)`
                      : "Riconnessione automatica in corso..."
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      connectionHealth === "connected"
                        ? "bg-emerald-400 animate-pulse"
                        : connectionHealth === "degraded"
                        ? "bg-amber-400"
                        : "bg-rose-400 animate-ping"
                    }`}
                  />
                  <span>
                    {connectionHealth === "connected"
                      ? latencyMs != null
                        ? `${latencyMs}ms`
                        : "Live"
                      : connectionHealth === "degraded"
                      ? `${latencyMs}ms`
                      : "Riconnessione"}
                  </span>
                </span>
              )}

              {pendingActionsCount != null && pendingActionsCount > 0 && (
                <span
                  className="inline-flex items-center px-1 py-0.2 rounded bg-amber-500/20 border border-amber-500/35 font-mono text-[8.5px] font-bold text-amber-300 whitespace-nowrap"
                  title="Azioni salvate localmente in attesa di riallineamento"
                >
                  {pendingActionsCount} in coda
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Chip Smartwatch Cardio */}
          <button
            type="button"
            onClick={() => setSmartWatchModalOpen(true)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${
              watch.isLive
                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                : "bg-white/5 border-white/10 text-[#C5A059] hover:border-[#C5A059]/40"
            }`}
            title={`Smartwatch Cardio: ${watch.isLive ? `${watch.bpm} BPM Live (${watch.deviceName || "Connesso"})` : "Collega Smartwatch BLE per trasmettere il battito live nel duello"}`}
          >
            <Watch size={10} className="shrink-0" />
            <span>{watch.isLive ? `${watch.bpm} BPM` : "Wearable"}</span>
          </button>

          {onOpenSpectatorShare && (
            <button
              type="button"
              onClick={onOpenSpectatorShare}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] hover:bg-[#C5A059]/30 transition-all font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
              title="Tribuna Spettatori: Mostra QR Code e Link Pubblico"
            >
              <Eye size={10} className="text-[#C5A059]" />
              <span>{spectatorCount ?? 0}</span>
            </button>
          )}

          {connectionHealth === "reconnecting" && onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] hover:bg-[#C5A059]/30 transition-colors whitespace-nowrap"
              title="Forza riconnessione immediata"
            >
              Riconnetti
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[#94A3B8] hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Synchronized Match Countdown Clock */}
      {matchSecondsRemaining != null && (
        <div
          className={`px-3 py-1.5 flex items-center justify-between font-mono text-[10px] border-b ${
            isMatchExpired || matchSecondsRemaining === 0
              ? "bg-[#7F1D1D]/40 border-[#EF4444]/50 text-[#FCA5A5]"
              : matchSecondsRemaining < 60
              ? "bg-[#7F1D1D]/30 border-[#EF4444]/40 text-[#FCA5A5]"
              : "bg-[#181922] border-[#C5A059]/20 text-[#D4AF37]"
          }`}
        >
          <span className="flex items-center gap-1.5 uppercase font-bold tracking-wider">
            <Clock
              size={12}
              className={matchSecondsRemaining < 60 || isMatchExpired ? "text-[#EF4444] animate-pulse" : "text-[#D4AF37]"}
            />
            {isMatchExpired || matchSecondsRemaining === 0 ? "Prova Conclusa" : "Tempo Prova:"}
          </span>
          <strong
            className={`tracking-wider ${
              matchSecondsRemaining < 60 || isMatchExpired ? "text-[#EF4444] animate-pulse font-extrabold" : "text-white"
            }`}
          >
            {isMatchExpired || matchSecondsRemaining === 0
              ? "STOP ORDINI"
              : formatTimeRemaining(matchSecondsRemaining)}
          </strong>
        </div>
      )}

      {/* Drawdown Alert Bar */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between font-mono text-[10px] border-b ${
          ddDanger
            ? "bg-[#7F1D1D]/30 border-[#EF4444]/40 text-[#FCA5A5]"
            : "bg-black/40 border-white/5 text-[#94A3B8]"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <ShieldAlert size={12} className={ddDanger ? "text-[#EF4444] animate-pulse" : "text-[#71717A]"} />
          Drawdown Attuale:
        </span>
        <strong className={ddDanger ? "text-[#EF4444]" : "text-white"}>
          {userDrawdownPct.toFixed(1)}% / {maxAllowedDrawdownPct}%
        </strong>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-[#0E0F14] text-[10px] font-mono">
        <button
          type="button"
          onClick={() => setActiveTab("standings")}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === "standings"
              ? "border-[#D4AF37] text-[#D4AF37] font-bold"
              : "border-transparent text-[#71717A] hover:text-white"
          }`}
        >
          Classifica ({sortedParticipants.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feed")}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === "feed"
              ? "border-[#D4AF37] text-[#D4AF37] font-bold"
              : "border-transparent text-[#71717A] hover:text-white"
          }`}
        >
          Feed Trade ({recentTrades.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("focus")}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === "focus"
              ? "border-[#D4AF37] text-[#D4AF37] font-bold"
              : "border-transparent text-[#71717A] hover:text-white"
          }`}
        >
          Focus
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-1">
        {activeTab === "standings" && (
          <div className="space-y-1">
            {sortedParticipants.map((p, idx) => (
              <div
                key={p.userId}
                className="flex items-center justify-between p-2 rounded bg-[#16171E] border border-white/5 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold text-[10px] w-4 text-center ${
                      idx === 0
                        ? "text-[#D4AF37]"
                        : idx === 1
                        ? "text-[#E2E8F0]"
                        : idx === 2
                        ? "text-[#CD7F32]"
                        : "text-[#71717A]"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className="font-semibold text-white block leading-tight truncate min-w-[120px] max-w-[180px] sm:max-w-[220px]"
                      title={p.displayName}
                    >
                      {p.displayName}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="whitespace-nowrap font-mono text-[9px] text-[#71717A]">
                        DD: {p.currentDrawdownPct.toFixed(1)}%
                      </span>
                      <span className="text-white/20">·</span>
                      {(() => {
                        const bpm = p.biometricBpm ?? 64;
                        const stress =
                          p.stressLevel ??
                          (bpm >= 95 ? "critical" : bpm >= 80 ? "elevated" : "calm");
                        const bpmColor =
                          stress === "critical"
                            ? "text-rose-400 border-rose-500/35 bg-rose-500/10"
                            : stress === "elevated"
                            ? "text-amber-400 border-amber-500/35 bg-amber-500/10"
                            : "text-emerald-400 border-emerald-500/35 bg-emerald-500/10";
                        const heartAnim = `${(60 / bpm).toFixed(2)}s`;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-1 py-0.2 rounded font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${bpmColor}`}
                            title={`Bio-Telemetria Operatore: ${bpm} BPM · ${
                              stress === "critical"
                                ? "Tensione Critica (Stop Prossimo)"
                                : stress === "elevated"
                                ? "Pressione Operativa"
                                : "Ritmo Sovrano Calmo"
                            }`}
                          >
                            <Heart
                              size={8}
                              className="shrink-0 fill-current"
                              style={{
                                animation: `btmHeartPulse ${heartAnim} ease-in-out infinite`,
                              }}
                            />
                            <span>{bpm} BPM</span>
                          </span>
                        );
                      })()}
                      <span className="text-white/20">·</span>
                      {(() => {
                        const presence = getParticipantPresence(p, now);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-1 py-0.2 rounded font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${presence.badgeClass}`}
                            title={`Ultima attività: ${p.lastActiveTs ? new Date(p.lastActiveTs).toLocaleTimeString() : "N/D"}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${presence.dotClass}`} />
                            <span>{presence.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono shrink-0">
                  <span
                    className={`font-bold block whitespace-nowrap ${
                      p.status === "disqualified"
                        ? "text-[#EF4444]"
                        : p.currentProfitPct >= 0
                        ? "text-[#34D399]"
                        : "text-[#EF4444]"
                    }`}
                  >
                    {p.status === "disqualified"
                      ? "SQUALIFICATO"
                      : `${p.currentProfitPct >= 0 ? "+" : ""}${p.currentProfitPct.toFixed(1)}%`}
                  </span>
                  <span className="whitespace-nowrap text-[9px] text-[#71717A]">
                    {p.tradesCount} trade
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "feed" && (
          <div className="space-y-1.5">
            {recentTrades.length === 0 ? (
              <div className="py-6 text-center text-[#71717A] text-[10px] font-mono">
                In attesa di ordini dai trader della stanza…
              </div>
            ) : (
              recentTrades.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded bg-[#14151C] border border-white/5 flex items-center justify-between text-[10.5px]"
                >
                  <div className="flex items-center gap-1.5">
                    {t.type === "BUY" ? (
                      <ArrowUpRight size={13} className="text-[#34D399]" />
                    ) : (
                      <ArrowDownRight size={13} className="text-[#EF4444]" />
                    )}
                    <span className="font-medium text-white">{t.displayName}</span>
                    <span
                      className={`font-mono text-[9.5px] font-bold ${
                        t.type === "BUY" ? "text-[#34D399]" : "text-[#EF4444]"
                      }`}
                    >
                      {t.type}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-[#94A3B8]">
                    @{t.price.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "focus" && (
          <div className="space-y-2 p-1">
            <span className="text-[10px] font-mono text-[#8E92A0] uppercase tracking-wider block">
              Sentenze di Disciplina (Invia alla Stanza)
            </span>
            <div className="space-y-1">
              {STOIC_SENTENCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSendSentence?.(s)}
                  className="w-full text-left p-1.5 rounded bg-[#16171E] border border-white/5 text-[10.5px] text-[#CBD5E1] hover:border-[#C5A059]/40 hover:text-white transition-all flex items-center justify-between"
                >
                  <span>&laquo;{s}&raquo;</span>
                  <ChevronRight size={11} className="text-[#C5A059]" />
                </button>
              ))}
            </div>

            {recentSentences.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <span className="text-[9.5px] font-mono text-[#71717A] uppercase">
                  Ultime Sentenze Trasmesse:
                </span>
                {recentSentences.map((sent, idx) => (
                  <div key={idx} className="text-[10px] text-[#CBD5E1] italic">
                    <strong className="text-[#D4AF37] not-italic">{sent.sender}:</strong> &laquo;{sent.sentence}&raquo;
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modale Smartwatch Live */}
      <SmartWatchConnectModal
        open={smartWatchModalOpen}
        onClose={() => setSmartWatchModalOpen(false)}
      />
    </div>
  );
}
