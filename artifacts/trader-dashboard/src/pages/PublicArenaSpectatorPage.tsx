import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import {
  Flame,
  Clock,
  Eye,
  Share2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Trophy,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { useBattleRoom } from "@/components/backtest-tournament/useBattleRoom";
import { LiveComparativeEquityChart } from "@/components/backtest-tournament/LiveComparativeEquityChart";
import { ArenaSpectatorShareModal } from "@/components/backtest-tournament/ArenaSpectatorShareModal";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "../lib/seo";
import { synestheticClick } from "@/lib/soundFx";
import type { RoomParticipant } from "../../../api-server/src/services/backtestTournaments/battleRoomTypes";

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PublicArenaSpectatorPage() {
  const [, paramsDuello] = useRoute("/duello/:roomId");
  const [, paramsBattle] = useRoute("/battle/:roomId");

  const rawRoomId = paramsDuello?.roomId || paramsBattle?.roomId || "custom_forgia_demo";
  const roomId = decodeURIComponent(rawRoomId);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialSnapshot, setInitialSnapshot] = useState<{
    participants: RoomParticipant[];
    rules?: any;
    matchEndsAt?: number;
    spectatorCount?: number;
  } | null>(null);

  // 1. Snapshot iniziale via REST (instant loading pre-connessione)
  useEffect(() => {
    let active = true;
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`/api/backtest-tournaments/battle-rooms/${encodeURIComponent(roomId)}/public`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setInitialSnapshot(data);
          }
        }
      } catch {
        // Fallback sul socket
      } finally {
        if (active) setInitialLoading(false);
      }
    };
    fetchSnapshot();
    return () => {
      active = false;
    };
  }, [roomId]);

  // 2. Connessione WebSocket in sola lettura (Modalità Spettatore)
  const {
    participants: wsParticipants,
    roomRules,
    recentTrades,
    recentSentences,
    matchSecondsRemaining,
    isMatchExpired,
    spectatorCount: wsSpectatorCount,
    equityHistory,
    lastDisqualification,
    connectionHealth,
  } = useBattleRoom({
    roomId,
    mode: "spectator",
    enabled: Boolean(roomId),
  });

  const participants = wsParticipants.length > 0 ? wsParticipants : initialSnapshot?.participants || [];
  const spectatorCount = Math.max(1, wsSpectatorCount || initialSnapshot?.spectatorCount || 1);
  const rules = roomRules || initialSnapshot?.rules;

  const combatantNames = participants.map((p) => p.displayName);

  return (
    <div className="min-h-screen bg-[#07080b] text-white flex flex-col selection:bg-[#C5A059]/30 selection:text-white">
      <Seo
        title={`Tribuna Spettatori · Arena dei Duelli ${roomId} · AUREUS PROTOCOL`}
        description="Assisti dal vivo alle Prove del Fuoco. Telemetria sincrona, battito cardiaco neocorticale e curve di capitale comparative nel Protocollo AUREUS."
        lang="it"
        canonical={absoluteUrl(`/duello/${encodeURIComponent(roomId)}`)}
      />

      <style>{`
        @keyframes btmArenaHeartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>

      {/* Testata Sovrana Spettatore */}
      <header className="border-b border-[#C5A059]/25 bg-[#0d0f14]/95 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/tornei"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)] hover:bg-[#C5A059]/25 transition-all"
              title="Torna alle Prove del Fuoco"
            >
              <Flame size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif text-sm sm:text-base font-bold tracking-wider text-white uppercase">
                  Le Prove del Fuoco
                </span>
                <span className="rounded bg-[#C5A059]/15 border border-[#C5A059]/35 px-2 py-0.5 font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider whitespace-nowrap">
                  Tribuna Spettatori
                </span>
                <span className="rounded bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-400 uppercase tracking-wider inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Stanza: <strong className="text-white font-mono">{roomId}</strong>
                {rules?.pair ? ` · ${rules.pair} ${rules.timeframe || ""}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Pillola Spettatori Connessi */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171E] px-3 py-1.5 font-mono text-xs text-[#E8C56A]">
              <Eye size={14} className="text-[#C5A059]" />
              <span className="font-bold whitespace-nowrap">{spectatorCount}</span>
              <span className="text-muted-foreground whitespace-nowrap text-[11px]">in Tribuna</span>
            </div>

            {/* Pillola Tempo Rimanente */}
            {matchSecondsRemaining != null && (
              <div
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold whitespace-nowrap ${
                  isMatchExpired || matchSecondsRemaining === 0
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                    : matchSecondsRemaining < 60
                    ? "bg-rose-500/15 border-rose-500/35 text-rose-400 animate-pulse"
                    : "bg-[#16171E] border-[#C5A059]/30 text-[#E8C56A]"
                }`}
              >
                <Clock size={14} />
                <span>
                  {isMatchExpired || matchSecondsRemaining === 0
                    ? "PROVA CONCLUSA"
                    : `TEMPO: ${formatSeconds(matchSecondsRemaining)}`}
                </span>
              </div>
            )}

            {/* Tasto Condividi Arena */}
            <button
              type="button"
              onClick={() => {
                synestheticClick();
                setIsShareModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059] bg-gradient-to-r from-[#C5A059] to-[#E8C56A] px-3.5 py-1.5 font-mono text-xs font-bold text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.25)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
            >
              <Share2 size={13} />
              <span>Condividi Arena</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Squalifica per Violazione Rischio */}
      {lastDisqualification && (
        <div className="bg-[#7F1D1D]/50 border-b border-[#EF4444]/60 px-4 py-2 text-center text-xs font-mono text-rose-200 flex items-center justify-center gap-2">
          <ShieldAlert size={14} className="text-rose-400 animate-bounce" />
          <span>
            Violazione di Disciplina: <strong>{lastDisqualification.displayName}</strong> è stato squalificato ({lastDisqualification.reason}).
          </span>
        </div>
      )}

      {/* Corpo Principale Cockpit Spettatore */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Griglia Card dei Sfidanti */}
        <section aria-label="Sfidanti nell'Arena">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-2">
              <Trophy size={14} />
              I Contendenti della Prova
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
              Regola Inviolabile: Max Drawdown 10.0%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {participants.map((p, idx) => {
              const isDisqualified = p.status === "disqualified";

              return (
                <div
                  key={p.userId}
                  className={`rounded-xl border p-4 bg-[#0d0f14] flex flex-col justify-between shadow-lg transition-all ${
                    isDisqualified
                      ? "border-rose-500/40 bg-rose-950/10 opacity-75"
                      : idx === 0 && p.currentProfitPct > 0
                      ? "border-[#C5A059]/60 shadow-[0_0_20px_rgba(197,160,89,0.12)]"
                      : "border-white/10"
                  }`}
                >
                  <div>
                    {/* Header Card Sfidante */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#C5A059] w-5 text-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white truncate max-w-[150px] sm:max-w-[180px]">
                            {p.displayName}
                          </h3>
                          <span className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-wider block truncate">
                            {p.gradeTitle || "Iniziato dell'Ordine"}
                          </span>
                        </div>
                      </div>

                      {p.biometricBpm ? (
                        <div
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 font-mono text-[10px] text-rose-300 whitespace-nowrap"
                          title="Frequenza cardiaca neocorticale dell'Operatore"
                        >
                          <Heart
                            size={11}
                            className="text-rose-500 fill-rose-500 shrink-0"
                            style={{ animation: "btmArenaHeartbeat 1s infinite" }}
                          />
                          <span className="font-bold">{p.biometricBpm}</span>
                          <span className="text-[9px] text-rose-400/80">BPM</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Metriche Finanziarie Chiave */}
                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-[#07080b] border border-white/5 font-mono text-xs">
                      <div>
                        <span className="text-muted-foreground text-[9.5px] block uppercase">P&amp;L Attuale</span>
                        <span
                          className={`font-bold text-sm block whitespace-nowrap ${
                            isDisqualified
                              ? "text-rose-400"
                              : p.currentProfitPct >= 0
                              ? "text-[#10b981]"
                              : "text-[#ef4444]"
                          }`}
                        >
                          {isDisqualified
                            ? "SQUALIFICATO"
                            : `${p.currentProfitPct >= 0 ? "+" : ""}${p.currentProfitPct.toFixed(2)}%`}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[9.5px] block uppercase">Operazioni</span>
                        <span className="font-bold text-sm text-white block whitespace-nowrap">
                          {p.tradesCount} Trade
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barra Drawdown Rispetto al Limite 10% */}
                  <div>
                    <div className="flex items-center justify-between text-[9.5px] font-mono mb-1">
                      <span className="text-muted-foreground whitespace-nowrap">Drawdown Raggiunto:</span>
                      <span
                        className={`font-bold whitespace-nowrap ${
                          p.currentDrawdownPct >= 8.0 ? "text-rose-400" : "text-white/80"
                        }`}
                      >
                        {p.currentDrawdownPct.toFixed(1)}% / 10.0%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          p.currentDrawdownPct >= 8.0
                            ? "bg-rose-500"
                            : p.currentDrawdownPct >= 5.0
                            ? "bg-amber-400"
                            : "bg-[#C5A059]"
                        }`}
                        style={{
                          width: `${Math.min(100, (p.currentDrawdownPct / 10.0) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Layout a 2 Colonne: Grafico Comparativo (Sx) & Feed Operativo / Sentenze (Dx) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Colonna Sinistra: Grafico Comparativo Live (7 colonne) */}
          <div className="lg:col-span-7 flex flex-col">
            <LiveComparativeEquityChart
              participants={participants}
              equityHistory={equityHistory}
              className="h-full flex-1"
            />
          </div>

          {/* Colonna Destra: Feed Ordini & Sentenze (5 colonne) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Box Feed Ordini in Tempo Reale */}
            <div className="rounded-xl border border-white/10 bg-[#0d0f14] p-4 flex flex-col flex-1 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#C5A059]" />
                  Feed Ordini Live ({recentTrades.length})
                </span>
                <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  Ultime Esecuzioni
                </span>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[220px] flex-1 pr-1">
                {recentTrades.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground font-mono text-xs">
                    In attesa che i duellanti aprano le prime posizioni…
                  </div>
                ) : (
                  recentTrades.map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded bg-[#07080b] border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {t.type === "BUY" ? (
                          <ArrowUpRight size={14} className="text-[#10b981] shrink-0" />
                        ) : (
                          <ArrowDownRight size={14} className="text-[#ef4444] shrink-0" />
                        )}
                        <span className="font-bold text-white truncate max-w-[120px]">
                          {t.displayName}
                        </span>
                        <span
                          className={`font-bold text-[10px] uppercase px-1 py-0.2 rounded border whitespace-nowrap ${
                            t.type === "BUY"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          }`}
                        >
                          {t.type}
                        </span>
                      </div>

                      <div className="text-right whitespace-nowrap shrink-0">
                        <span className="text-white/80 font-bold block">
                          @{t.price.toFixed(2)}
                        </span>
                        {t.pnl != null && (
                          <span
                            className={`text-[9.5px] font-bold ${
                              t.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                            }`}
                          >
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Box Sentenze della Disciplina */}
            <div className="rounded-xl border border-[#C5A059]/20 bg-[#0d0f14] p-3.5 shadow-lg">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] block mb-2">
                Le Sentenze della Disciplina
              </span>
              <div className="space-y-1.5">
                {recentSentences.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-[11px] italic">
                    «La disciplina precede il profitto. Nessun cedimento emotivo ammesso nell'Arena.»
                  </p>
                ) : (
                  recentSentences.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-[11px] font-mono text-white/80 border-l-2 border-[#C5A059] pl-2 py-0.5">
                      <strong className="text-[#E8C56A] not-italic mr-1">{s.sender}:</strong>
                      <span className="italic">&laquo;{s.sentence}&raquo;</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Banner Solenne Call-to-Action per Spettatori Esterni */}
        <section
          aria-label="Accesso al Protocollo"
          className="rounded-2xl border border-[#C5A059]/30 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl"
        >
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={18} className="text-[#C5A059]" />
              <h3 className="font-serif text-base font-bold text-white uppercase tracking-wider">
                Misura la tua Disciplina nella Forgia
              </h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Il Protocollo AUREUS non ammette scommesse o derive emotive. Entra nella Forgia del Passato, affronta i test di idoneità e forgia il tuo Grado Operativo.
            </p>
          </div>

          <Link
            href="/welcome"
            className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] bg-gradient-to-r from-[#C5A059] to-[#E8C56A] px-5 py-2.5 font-mono text-xs font-bold text-[#07080b] shadow-[0_0_20px_rgba(197,160,89,0.3)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Inizia il Percorso d'Integrità</span>
            <ArrowRight size={14} />
          </Link>
        </section>
      </main>

      {/* Modale Condivisione Spettatori */}
      <ArenaSpectatorShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomId={roomId}
        roomCode={rules?.title || roomId}
        combatantNames={combatantNames}
      />
    </div>
  );
}
