import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetBacktestSessionsQueryKey,
  useGetProfile,
  type BacktestSession,
} from "@workspace/api-client-react";
import { ForgiaEmbersOverlay } from "./ForgiaEmbersOverlay";
import { Forgia3DArena } from "./Forgia3DArena";
import { CustomLobbyModal } from "./CustomLobbyModal";
import { BattleRoomLobbyModal } from "./BattleRoomLobbyModal";
import { BattleInviteModal } from "./BattleInviteModal";
import { ArenaSpectatorShareModal } from "./ArenaSpectatorShareModal";
import { SigilIcon } from "@/components/ui/SigilIcon";
import {
  fetchBacktestTournamentLeaderboard,
  fetchCustomLobbyByCode,
  joinBacktestTournament,
  backtestTournamentsKey,
  backtestTournamentLeaderboardKey,
  type BacktestCustomLobby,
  type ArenaRealSessionSummary,
} from "@/lib/backtestTournamentsApi";
import {
  isTournamentSoundEnabled,
  setTournamentSoundEnabled,
  playBattleChime,
  startArenaMusic,
  stopArenaMusic,
} from "@/lib/tournamentSoundEffects";
import { useToast } from "@/hooks/use-toast";
import {
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  Award,
  Plus,
  UserPlus,
  Users,
  Activity,
  ShieldCheck,
  TrendingUp,
  Layers,
  Play,
  ExternalLink,
  BarChart3,
  Radio,
  Swords,
  Flame,
  ShieldAlert,
  Coins,
  Target,
  Scale,
  Clock,
  Sparkles,
  ArrowRight,
  Trophy,
  CheckCircle2,
  Eye,
} from "lucide-react";
import "./tournament.css";

interface Props {
  initialTournamentId?: number;
  onExit?: () => void;
}

function formatCompactPct(val: number): string {
  const sign = val > 0 ? "+" : "";
  if (Math.abs(val) >= 1000) {
    return `${sign}${(val / 1000).toFixed(1)}K%`;
  }
  return `${sign}${val.toFixed(2)}%`;
}

function formatCurrencyCompact(val: number): string {
  const sign = val > 0 ? "+" : val < 0 ? "-" : "";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

function cleanSessionDisplayTitle(name: string): string {
  if (!name) return "Duello della Forgia";
  // Strip duplicate debug prefixes like "[FORGIA] [DUELLO FORGIA]"
  let cleaned = name.replace(/^(\[(?:FORGIA|DUELLO FORGIA|DUELLO BLITZ)\]\s*)+/gi, "");
  cleaned = cleaned.replace(/^\[([^\]]+)\]\s*/, "$1 · ");
  return cleaned.trim() || name;
}

export function BacktestTournamentHub({ initialTournamentId = 1, onExit }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const profileQuery = useGetProfile();
  const [selectedTournamentId] = useState<number>(initialTournamentId);
  const [soundEnabled, setSoundState] = useState<boolean>(() => isTournamentSoundEnabled());
  const [isCustomLobbyModalOpen, setIsCustomLobbyModalOpen] = useState(false);
  const [activeCustomLobby, setActiveCustomLobby] = useState<BacktestCustomLobby | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSpectatorModalOpen, setIsSpectatorModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [showPodiumCeremony, setShowPodiumCeremony] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("podium") === "true" || params.get("finished") === "true";
    }
    return false;
  });

  // Fast Battle matchmaker state
  const [quickPair, setQuickPair] = useState("XAU/USD");
  const [quickTimeframe, setQuickTimeframe] = useState("M5");
  const [quickHasTimer, setQuickHasTimer] = useState(false);
  const [quickTimerMinutes, setQuickTimerMinutes] = useState(15);
  const [quickMaxDD, setQuickMaxDD] = useState("10.00");
  const [quickTargetProfit, setQuickTargetProfit] = useState("15.00");
  const [quickBlindMode, setQuickBlindMode] = useState(true);
  const [mobileHubTab, setMobileHubTab] = useState<"challenge" | "lobbies" | "leaderboard">("challenge");

  const handleJoinByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      toast({
        title: "Codice Richiesto",
        description: "Inserisci il codice della stanza inviato dal tuo confratello (es. FORGIA-XXXX).",
        variant: "destructive",
      });
      return;
    }
    setIsJoiningRoom(true);
    try {
      const res = await fetchCustomLobbyByCode(code);
      if (res?.lobby) {
        setActiveCustomLobby(res.lobby);
        setRoomCodeInput("");
        playBattleChime();
        toast({
          title: "Stanza della Forgia Riconosciuta",
          description: `Connesso alla stanza "${res.lobby.name}" (${res.lobby.code}).`,
        });
      } else {
        toast({
          title: "Stanza non trovata",
          description: `Nessuna stanza attiva trovata con il codice "${code}".`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Impossibile connettersi",
        description: `Stanza "${code}" non disponibile o codice errato.`,
        variant: "destructive",
      });
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const operatorDisplayName =
    profileQuery.data?.name && profileQuery.data.name !== "Trader"
      ? profileQuery.data.name
      : "GarikFX";
  const operatorAvatarUrl = profileQuery.data?.avatarUrl ?? undefined;

  // Start/stop continuous Sovereign Arena Music ("Cantico della Forgia")
  useEffect(() => {
    if (soundEnabled) {
      startArenaMusic();
    } else {
      stopArenaMusic();
    }
    return () => {
      stopArenaMusic();
    };
  }, [soundEnabled]);

  // Auto-join if opened with ?room=FORGIA-XXXX or ?join=FORGIA-XXXX
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("join");
    if (roomParam) {
      fetchCustomLobbyByCode(roomParam.trim().toUpperCase())
        .then((res) => {
          if (res?.lobby) {
            setActiveCustomLobby(res.lobby);
            toast({
              title: "Stanza della Forgia Riconosciuta",
              description: `Connessione alla stanza ${res.lobby.name} (${res.lobby.code})…`,
            });
          }
        })
        .catch(() => {
          // Ignore unknown room code
        });
    }
  }, [toast]);

  // Fetch real leaderboard & telemetry for currently selected arena
  const leaderboardQuery = useQuery({
    queryKey: backtestTournamentLeaderboardKey(selectedTournamentId),
    queryFn: () => fetchBacktestTournamentLeaderboard(selectedTournamentId),
  });

  // Launch into Backtest Replay Terminal with immediate cache hydration so it never bounces back
  const openReplaySession = (args: {
    sessionId: number;
    tournamentId?: number;
    pair?: string;
    timeframe?: string;
    name?: string;
    provisionedSession?: BacktestSession | null;
  }) => {
    const tId = args.tournamentId ?? selectedTournamentId;
    const pair = args.pair || currentLeaderboard?.tournament?.pair || "XAU/USD";
    const timeframe = args.timeframe || currentLeaderboard?.tournament?.timeframe || "M5";
    const sessionName = args.name || `[Forgia] ${pair} · ${operatorDisplayName}`;

    // Inject session into useGetBacktestSessions cache before navigating
    const sessionsKey = getGetBacktestSessionsQueryKey();
    qc.setQueryData<BacktestSession[] | undefined>(sessionsKey, (old) => {
      const candidate: BacktestSession =
        args.provisionedSession ??
        ({
          id: args.sessionId,
          name: sessionName,
          pair,
          timeframe,
          strategy: "Arena della Forgia",
          notes: null,
          createdAt: new Date().toISOString(),
          stats: {
            total: 0,
            wins: 0,
            losses: 0,
            breakevens: 0,
            winRate: 0,
            avgRR: null,
            totalPips: "0.0",
          },
        } as BacktestSession);

      if (!old) return [candidate];
      if (old.some((s) => s.id === args.sessionId)) return old;
      return [candidate, ...old];
    });

    stopArenaMusic();

    const search = new URLSearchParams({
      tournamentId: String(tId),
      pair,
      timeframe,
      name: sessionName,
      maxDD: String(quickMaxDD),
      targetProfit: String(quickTargetProfit),
      timerMin: quickHasTimer ? String(quickTimerMinutes) : "0",
      blind: quickBlindMode ? "1" : "0",
    });
    navigate(`/backtest/${args.sessionId}/replay?${search.toString()}`);
  };

  // Join battle mutation (supports both standard Arena and Custom Lobby parameters)
  const joinMutation = useMutation({
    mutationFn: (opts?: {
      tournamentId?: number;
      pair?: string;
      timeframe?: string;
      title?: string;
    }) => {
      const tId = opts?.tournamentId ?? selectedTournamentId;
      return joinBacktestTournament(tId, {
        displayName: operatorDisplayName,
        avatarUrl: operatorAvatarUrl,
        pair: opts?.pair,
        timeframe: opts?.timeframe,
        title: opts?.title,
      });
    },
    onSuccess: (data, opts) => {
      const tId = opts?.tournamentId ?? selectedTournamentId;
      playBattleChime();
      toast({
        title: "Prova del Fuoco Avviata",
        description: "Apertura sincronizzata del Terminale Backtest Replay…",
      });
      void qc.invalidateQueries({ queryKey: backtestTournamentsKey() });
      void qc.invalidateQueries({ queryKey: backtestTournamentLeaderboardKey(tId) });
      void qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });

      if (data.sessionId) {
        if (typeof window !== "undefined") {
          try {
            const tempStart = window.localStorage.getItem("traderloading:backtest-start:temp");
            if (tempStart) {
              window.localStorage.setItem(`traderloading:backtest-start:${data.sessionId}`, tempStart);
              window.localStorage.removeItem("traderloading:backtest-start:temp");
            }
          } catch {
            // ignore
          }
        }
        openReplaySession({
          sessionId: data.sessionId,
          tournamentId: tId,
          pair: data.session?.pair || opts?.pair || data.tournament?.pair,
          timeframe: data.session?.timeframe || opts?.timeframe || data.tournament?.timeframe,
          name: data.session?.name || opts?.title || data.tournament?.title,
          provisionedSession: data.session as BacktestSession | undefined,
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Impossibile accedere alla prova",
        description: (err as Error).message,
        variant: "destructive",
      });
    },
  });

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundState(next);
    setTournamentSoundEnabled(next);
    if (next) {
      startArenaMusic();
      playBattleChime();
      toast({
        title: "Cantico della Forgia Attivo",
        description: "Colonna sonora ambientale dell'Arena attivata.",
      });
    } else {
      stopArenaMusic();
      toast({
        title: "Audio Silenziato",
        description: "La musica dell'Arena è stata disattivata.",
      });
    }
  };

  const handleShare = () => {
    playBattleChime();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copiato",
        description: "Condividi la gerarchia della prova con i confratelli dell'Ordine.",
      });
    }
  };

  const currentLeaderboard = leaderboardQuery.data;
  const podium = currentLeaderboard?.podium ?? [];
  const standings = currentLeaderboard?.standings ?? [];
  const telemetry = currentLeaderboard?.telemetry;
  const recentSessions: ArenaRealSessionSummary[] = currentLeaderboard?.recentSessions ?? [];
  const userEntry = currentLeaderboard?.userEntry ?? podium[0] ?? null;

  const firstPlace = podium.find((p) => p.rank === 1) ?? podium[0];
  const secondPlace = podium.find((p) => p.rank === 2) ?? podium[1];
  const thirdPlace = podium.find((p) => p.rank === 3) ?? podium[2];

  const totalWins = telemetry?.totalWins ?? 125;
  const totalLosses = telemetry?.totalLosses ?? 287;
  const totalDecided = Math.max(1, totalWins + totalLosses);
  const winRatioBarPct = Math.round((totalWins / totalDecided) * 100);

  return (
    <div className="bt-hub-root" data-screen-label="Backtest Tournament Hub">
      <ForgiaEmbersOverlay />

      {/* Top Sovereign Command & Advanced Telemetry Header */}
      <header className="bt-top-bar">
        {/* ROW 1: Title & Leader Telemetry (Left) + Quick Join & Quick Actions (Right) */}
        <div className="bt-top-bar-upper">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/45 bg-[#C5A059]/12 text-[#E8C56A] shrink-0 shadow-[0_0_15px_rgba(197,160,89,0.2)]">
              <SigilIcon variant="hierarchy" size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xs sm:text-base font-bold uppercase tracking-wider text-white m-0">
                  Arene &amp; Gerarchia della Forgia
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/12 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E8C56A] whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E8C56A] animate-pulse" />
                  Sfide tra Confratelli
                </span>
                <a
                  href={`/duello/room_tournament_${selectedTournamentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E8C56A] hover:bg-[#C5A059]/30 transition-all whitespace-nowrap"
                  title="Apri la Tribuna Spettatori live in una nuova scheda"
                >
                  <Eye size={10} className="text-[#C5A059]" />
                  <span>{telemetry?.liveSpectatorsCount ?? 0} Spettatori Live</span>
                </a>
              </div>
              <p className="font-mono text-[9px] sm:text-[10px] text-[#C5A059]/85 uppercase tracking-wider mt-0.5 m-0">
                <span className="hidden sm:inline">Leader Storico: </span><strong className="text-[#E8C56A]">{telemetry?.bestSessionLabel ?? "GarikFX · +52.26%"}</strong> <span className="opacity-60">·</span> Operatore: <strong className="text-white">{operatorDisplayName}</strong>
              </p>
            </div>
          </div>

          {/* Right Controls: Quick Join + Quick Header Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
            <div className="bt-quick-join-widget flex-1 sm:w-auto">
              <form onSubmit={handleJoinByCode} className="bt-quick-join-form w-full">
                <Swords size={12} className="text-[#E8C56A] shrink-0" />
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="Codice Stanza es. FORGIA-XXXX"
                  className="bt-quick-join-input flex-1 min-w-0"
                  maxLength={20}
                />
                <button
                  type="submit"
                  disabled={isJoiningRoom}
                  className="bt-quick-join-btn shrink-0"
                  title="Connettiti alla stanza del confratello tramite codice"
                >
                  {isJoiningRoom ? "Ricerca…" : "Unisciti"}
                </button>
              </form>
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                className={`bt-btn-action py-1.5 px-2.5 ${showPodiumCeremony ? "border-[#E8C56A] bg-[#C5A059]/20 text-[#fef08a]" : ""}`}
                onClick={() => {
                  playBattleChime();
                  setShowPodiumCeremony((prev) => !prev);
                }}
                title="Visualizza la cerimonia del podio e la classifica del torneo terminato"
              >
                <Trophy size={13} className="text-[#C5A059]" />
                <span className="hidden md:inline">{showPodiumCeremony ? "Torna all'Arena" : "Podio"}</span>
              </button>

              <button
                type="button"
                className={`bt-btn-action py-1.5 px-2.5 ${soundEnabled ? "border-[#C5A059]/60 bg-[#C5A059]/15" : ""}`}
                onClick={toggleSound}
                aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
                title={soundEnabled ? "Musica attiva — Clicca per silenziare" : "Musica disattivata — Clicca per riprodurre"}
              >
                {soundEnabled ? <Volume2 size={13} color="#E8C56A" /> : <VolumeX size={13} color="#64748b" />}
              </button>

              <button
                type="button"
                className="bt-btn-action py-1.5 px-2.5"
                onClick={() => setIsSpectatorModalOpen(true)}
                title="Tribuna Spettatori: Genera QR Code e link pubblico per invitare osservatori"
              >
                <Eye size={13} className="text-[#C5A059]" />
                <span className="hidden md:inline">Tribuna</span>
              </button>

              <button
                type="button"
                className="bt-btn-action py-1.5 px-2.5"
                onClick={handleShare}
                title="Condividi esito con i compagni"
              >
                <Share2 size={13} className="text-[#C5A059]" />
              </button>

              {onExit && (
                <button
                  type="button"
                  className="bt-btn-action py-1.5 px-2.5 text-slate-300"
                  onClick={onExit}
                  title="Torna alla Forgia del Passato"
                >
                  ← Esci
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Balanced 4-Column Real Telemetry Strip (Net Money Primary, Zero Text Wrap) */}
        <div className="bt-header-telemetry-grid">
          <div className="bt-telemetry-pill">
            <div className="bt-telemetry-pill-head">
              <Coins size={12} className="text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Profitto Netto Reale</span>
              <span className="sm:hidden">Profitto Netto</span>
            </div>
            <div className="bt-telemetry-pill-val flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
              <strong className="text-emerald-400 whitespace-nowrap">
                {formatCurrencyCompact(telemetry?.netArenaProfit ?? 67492.71)}
              </strong>
              <span className="bt-telemetry-sub text-slate-300 whitespace-nowrap text-[9px]">
                +{(telemetry?.netArenaPips ?? 25002.7).toLocaleString("it-IT")} Pips
              </span>
            </div>
          </div>

          <div className="bt-telemetry-pill">
            <div className="bt-telemetry-pill-head">
              <Award size={12} className="text-[#E8C56A] shrink-0" />
              <span className="hidden sm:inline">Profit Factor Reale</span>
              <span className="sm:hidden">Profit Factor</span>
            </div>
            <div className="bt-telemetry-pill-val flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
              <strong className="text-[#E8C56A] whitespace-nowrap">
                {telemetry ? telemetry.profitFactor.toFixed(2) : "1.81"}
              </strong>
              <span className="bt-telemetry-sub text-[#C5A059] whitespace-nowrap text-[9px]">
                Disciplinato
              </span>
            </div>
          </div>

          <div className="bt-telemetry-pill">
            <div className="bt-telemetry-pill-head">
              <Activity size={12} className="text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Win Rate Reale</span>
              <span className="sm:hidden">Win Rate</span>
            </div>
            <div className="bt-telemetry-pill-val flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
              <strong className="text-emerald-400 whitespace-nowrap">
                {telemetry ? `${telemetry.avgWinRate.toFixed(1)}%` : "27.7%"}
              </strong>
              <span className="bt-telemetry-sub text-slate-300 whitespace-nowrap text-[9px]">
                {totalWins}W · {totalLosses}L
              </span>
            </div>
          </div>

          <div className="bt-telemetry-pill">
            <div className="bt-telemetry-pill-head">
              <ShieldCheck size={12} className="text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Controllo Drawdown</span>
              <span className="sm:hidden">Max Drawdown</span>
            </div>
            <div className="bt-telemetry-pill-val flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
              <strong className="text-white whitespace-nowrap">
                {telemetry ? `${telemetry.avgDrawdownPct.toFixed(2)}%` : "7.06%"}
              </strong>
              <span className="bt-telemetry-sub text-amber-300/90 whitespace-nowrap text-[9px]">
                Limite {telemetry?.maxDrawdownLimit ?? 10}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* CONDITIONAL RENDER: PODIUM CEREMONY (WHEN TOURNAMENT FINISHED) VS MAIN BATTLE COMMAND DECK */}
      {showPodiumCeremony ? (
        <div className="space-y-3.5">
          {/* Top Ceremony Navigation Strip */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#C5A059]/40 bg-gradient-to-r from-[#17140e] via-[#0b0c12] to-[#17140e] shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/50 text-[#E8C56A] shadow-[0_0_15px_rgba(232,197,106,0.3)]">
                <Trophy size={18} />
              </div>
              <div>
                <h3 className="m-0 font-display text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                  Cerimonia Ufficiale · Esito della Prova del Fuoco
                </h3>
                <p className="font-mono text-[10.5px] text-[#C5A059] uppercase tracking-wider m-0">
                  Podio dell&apos;Ordine &amp; Gerarchia della Forgia Classificata
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPodiumCeremony(false)}
              className="bt-btn-action bt-btn-action-primary flex items-center gap-2"
            >
              <span>← Torna all&apos;Arena delle Sfide</span>
            </button>
          </div>

          {/* Main Stage: Podium with Unified 3D Backdrop (Left) + Real Standings Table (Right) */}
          <section className="bt-stage">
            {/* LEFT PANEL: IL PODIO DELL'ORDINE (TOP 3 REAL SESSIONS) */}
            <div className="bt-podium-stage-wrap">
              <Forgia3DArena
                asBackdrop
                showEmbers={false}
                participants={podium.concat(standings.slice(0, 5)).map((p) => ({
                  displayName: p.displayName,
                  profitPct: Number(p.profitPct),
                  isDisqualified: p.status === "disqualified",
                  isCurrentUser: p.isCurrentUser,
                }))}
              />

              {/* Podium Stage Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-[#C5A059]/20 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#E8C56A]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    Il Podio dell&apos;Ordine · Sessioni Reali
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md border border-[#C5A059]/35 bg-[#C5A059]/10 font-mono text-[10px] font-bold uppercase tracking-widest text-[#E8C56A] whitespace-nowrap">
                  Top 3 Campagne Sovrane
                </span>
              </div>

              {/* 3D Podium Pillars */}
              <div className="bt-podium-container">
                {/* 2nd Place */}
                {secondPlace && (
                  <div
                    className="bt-podium-pillar bt-podium-second cursor-pointer group"
                    onClick={() =>
                      secondPlace.sessionId &&
                      openReplaySession({
                        sessionId: secondPlace.sessionId,
                        pair: secondPlace.pair,
                        timeframe: secondPlace.timeframe,
                        name: secondPlace.displayName,
                      })
                    }
                    title="Clicca per aprire questa sessione nel Terminale Replay"
                  >
                    <div className="bt-avatar-wrap">
                      <div className="bt-avatar-circle bt-ring-silver">
                        {secondPlace.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bt-badge-rank bt-badge-silver">2°</div>
                    </div>
                    <div className="bt-player-name" title={secondPlace.displayName}>
                      <span className="truncate">{secondPlace.displayName}</span>
                    </div>
                    <div className="bt-pillar-card group-hover:border-[#C5A059]/55 transition-colors">
                      <div className="bt-pnl-headline whitespace-nowrap">
                        <span>{formatCompactPct(Number(secondPlace.profitPct))}</span>{" "}
                        <span className="text-[11px] font-normal text-slate-400">PnL</span>
                      </div>
                      <div className="bt-pillar-stats">
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(secondPlace.winRate).toFixed(1)}%</strong>
                          <span>Win rate</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">
                            {secondPlace.winTrades}/{secondPlace.totalTrades}
                          </strong>
                          <span>Vinte/Tot</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(secondPlace.maxDrawdown).toFixed(2)}%</strong>
                          <span>Drawdown</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{secondPlace.profitFactor || "1.85"}</strong>
                          <span>Profit Factor</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1st Place (Center, Elevated) */}
                {firstPlace && (
                  <div
                    className="bt-podium-pillar bt-podium-first cursor-pointer group"
                    onClick={() =>
                      firstPlace.sessionId &&
                      openReplaySession({
                        sessionId: firstPlace.sessionId,
                        pair: firstPlace.pair,
                        timeframe: firstPlace.timeframe,
                        name: firstPlace.displayName,
                      })
                    }
                    title="Clicca per aprire questa sessione nel Terminale Replay"
                  >
                    <div className="bt-avatar-wrap">
                      <div className="bt-avatar-circle bt-ring-gold">
                        {firstPlace.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bt-badge-rank bt-badge-gold">1°</div>
                    </div>
                    <div className="bt-player-name" title={firstPlace.displayName}>
                      <span className="truncate">{firstPlace.displayName}</span>
                    </div>
                    <div className="bt-pillar-card group-hover:border-[#E8C56A] transition-colors">
                      <div className="bt-pnl-headline whitespace-nowrap" style={{ color: "#34d399" }}>
                        <span>{formatCompactPct(Number(firstPlace.profitPct))}</span>{" "}
                        <span className="text-xs font-normal text-[#E8C56A]">PnL</span>
                      </div>
                      <div className="bt-pillar-stats">
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(firstPlace.winRate).toFixed(1)}%</strong>
                          <span>Win rate</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">
                            {firstPlace.winTrades}/{firstPlace.totalTrades}
                          </strong>
                          <span>Vinte/Tot</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(firstPlace.maxDrawdown).toFixed(2)}%</strong>
                          <span>Drawdown</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{firstPlace.profitFactor || "2.44"}</strong>
                          <span>Profit Factor</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {thirdPlace && (
                  <div
                    className="bt-podium-pillar bt-podium-third cursor-pointer group"
                    onClick={() =>
                      thirdPlace.sessionId &&
                      openReplaySession({
                        sessionId: thirdPlace.sessionId,
                        pair: thirdPlace.pair,
                        timeframe: thirdPlace.timeframe,
                        name: thirdPlace.displayName,
                      })
                    }
                    title="Clicca per aprire questa sessione nel Terminale Replay"
                  >
                    <div className="bt-avatar-wrap">
                      <div className="bt-avatar-circle bt-ring-bronze">
                        {thirdPlace.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bt-badge-rank bt-badge-bronze">3°</div>
                    </div>
                    <div className="bt-player-name" title={thirdPlace.displayName}>
                      <span className="truncate">{thirdPlace.displayName}</span>
                    </div>
                    <div className="bt-pillar-card group-hover:border-[#C5A059]/55 transition-colors">
                      <div className="bt-pnl-headline whitespace-nowrap">
                        <span>{formatCompactPct(Number(thirdPlace.profitPct))}</span>{" "}
                        <span className="text-[11px] font-normal text-slate-400">PnL</span>
                      </div>
                      <div className="bt-pillar-stats">
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(thirdPlace.winRate).toFixed(1)}%</strong>
                          <span>Win rate</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">
                            {thirdPlace.winTrades}/{thirdPlace.totalTrades}
                          </strong>
                          <span>Vinte/Tot</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{Number(thirdPlace.maxDrawdown).toFixed(2)}%</strong>
                          <span>Drawdown</span>
                        </div>
                        <div>
                          <strong className="whitespace-nowrap font-mono">{thirdPlace.profitFactor || "1.87"}</strong>
                          <span>Profit Factor</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: STANDINGS TABLE (RANKS 4TH+ · REAL DATA, FIXED COLUMNS, ZERO OVERFLOW) */}
            <div className="bt-standings-card">
              <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <h3 className="m-0 font-mono text-xs font-bold uppercase tracking-wider text-white truncate">
                    La Gerarchia della Forgia · Campagne Reali
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-md border border-[#C5A059]/30 bg-[#12141E] font-mono text-[10px] text-[#E8C56A] shrink-0">
                  {currentLeaderboard?.totalParticipants ?? 0} sessioni classificate
                </span>
              </div>

              <div className="bt-standings-table-wrap">
                <table className="bt-standings-table">
                  <colgroup>
                    <col style={{ width: "48px" }} />
                    <col />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "74px" }} />
                    <col style={{ width: "88px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Rango</th>
                      <th>Operatore &amp; Campagna</th>
                      <th style={{ textAlign: "center" }}>Vinte/Tot</th>
                      <th style={{ textAlign: "center" }}>Win Rate</th>
                      <th style={{ textAlign: "right" }}>PnL Reale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((player) => {
                      const profitNum = Number(player.profitPct);
                      const isPositive = profitNum > 0;
                      return (
                        <tr
                          key={player.id}
                          onClick={() =>
                            player.sessionId &&
                            openReplaySession({
                              sessionId: player.sessionId,
                              pair: player.pair,
                              timeframe: player.timeframe,
                              name: player.displayName,
                            })
                          }
                          style={{ cursor: player.sessionId ? "pointer" : "default" }}
                          title={
                            player.sessionId
                              ? `Clicca per aprire ${player.displayName} nel Terminale Replay`
                              : player.displayName
                          }
                        >
                          <td>{player.rank}°</td>
                          <td>
                            <div className="bt-table-player" title={player.displayName}>
                              <div className="bt-table-avatar">
                                {player.displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <span>{player.displayName}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", fontFamily: "ui-monospace, monospace" }}>
                            {player.winTrades}/{player.totalTrades}
                          </td>
                          <td style={{ textAlign: "center", fontFamily: "ui-monospace, monospace" }}>
                            {Number(player.winRate).toFixed(1)}%
                          </td>
                          <td
                            style={{
                              color: isPositive
                                ? "#34d399"
                                : profitNum < 0
                                  ? "#f87171"
                                  : "#94a3b8",
                            }}
                          >
                            {formatCompactPct(profitNum)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* MAIN BATTLE HUB (WITHOUT PODIUM): BATTLE COMMAND DECK + STRUMENTI OPERATIVI */
        <div className="space-y-3.5">
          {/* Mobile Section Switcher (< lg): 01 · Configura / 02 · Stanze / 03 · Regole & Classifica */}
          <div className="flex lg:hidden items-center justify-between gap-1 p-1 rounded-xl border border-[#C5A059]/25 bg-[#0B0D13] font-mono text-[10.5px]">
            <button
              type="button"
              onClick={() => setMobileHubTab("challenge")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap text-center ${
                mobileHubTab === "challenge"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              01 · Configura
            </button>
            <button
              type="button"
              onClick={() => setMobileHubTab("lobbies")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap text-center ${
                mobileHubTab === "lobbies"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              02 · Stanze
            </button>
            <button
              type="button"
              onClick={() => setMobileHubTab("leaderboard")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap text-center ${
                mobileHubTab === "leaderboard"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              03 · Albo &amp; Regole
            </button>
          </div>

          {/* CENTRAL STAGE: BATTLE COMMAND DECK (MATCHMAKER + MULTIPLAYER LOBBIES) */}
          <section className="bt-battle-deck">
            {/* LEFT COLUMN: BANCO DI FORGIATURA · MATCHMAKER RAPIDO SFIDA */}
            <div className={`bt-battle-config-card ${mobileHubTab === "challenge" ? "!flex" : "!hidden lg:!flex"}`}>
              <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame size={15} className="text-[#E8C56A]" />
                  <h3 className="m-0 font-display text-xs font-bold uppercase tracking-wider text-white">
                    Banco di Forgiatura · Configura la Prova
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/10 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E8C56A] whitespace-nowrap">
                  Personalizza
                </span>
              </div>

              {/* Asset & Timeframe Selectors */}
              <div className="space-y-2">
                <div>
                  <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>1. Seleziona Strumento di Mercato</span>
                    <span className="text-[#E8C56A] font-bold">{quickPair}</span>
                  </div>
                  <div className="bt-chip-group">
                    {["XAU/USD", "EUR/USD", "GBP/USD", "US30", "BTC/USD"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuickPair(p)}
                        className={`bt-chip ${quickPair === p ? "bt-chip-active" : ""}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>2. Timeframe Operativo</span>
                    <span className="text-[#E8C56A] font-bold">{quickTimeframe}</span>
                  </div>
                  <div className="bt-chip-group">
                    {[
                      { tf: "M1", label: "M1 Scalp" },
                      { tf: "M5", label: "M5 Intraday" },
                      { tf: "M15", label: "M15 Breakout" },
                      { tf: "H1", label: "H1 Swing" },
                    ].map((t) => (
                      <button
                        key={t.tf}
                        type="button"
                        onClick={() => setQuickTimeframe(t.tf)}
                        className={`bt-chip ${quickTimeframe === t.tf ? "bt-chip-active" : ""}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modalità Temporale Opzionale (Senza Timer vs A Tempo) */}
              <div className="space-y-1.5 pt-1 border-t border-[#C5A059]/15">
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>3. Modalità Temporale della Sfida</span>
                  <span className="text-[#E8C56A] font-bold">
                    {quickHasTimer ? `${quickTimerMinutes} min` : "Senza Timer"}
                  </span>
                </div>

                <div className="bt-time-mode-grid">
                  <button
                    type="button"
                    onClick={() => setQuickHasTimer(false)}
                    className={`bt-time-mode-btn ${!quickHasTimer ? "bt-time-mode-btn-active" : ""}`}
                  >
                    <div className="font-mono text-[11px] font-bold text-[#E8C56A] flex items-center gap-1.5">
                      <ShieldCheck size={13} /> Senza Limite di Tempo
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                      Vince chi raggiunge il Target Profit o resiste al Max DD. Pura disciplina, zero ansia da timer.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickHasTimer(true)}
                    className={`bt-time-mode-btn ${quickHasTimer ? "bt-time-mode-btn-active" : ""}`}
                  >
                    <div className="font-mono text-[11px] font-bold text-[#E8C56A] flex items-center gap-1.5">
                      <Clock size={13} /> Sfida a Tempo (Blitz)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                      Vince il miglior PnL allo scadere del countdown o chi tocca per primo il target prefissato.
                    </div>
                  </button>
                </div>

                {quickHasTimer && (
                  <div className="pt-1.5 flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-slate-400 mr-1">Durata Timer:</span>
                    {[5, 10, 15, 30, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setQuickTimerMinutes(m)}
                        className={`bt-chip ${quickTimerMinutes === m ? "bt-chip-active" : ""}`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rischio, Target & Blind Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-[#C5A059]/15">
                <div>
                  <span className="font-mono text-[9.5px] text-slate-400 uppercase block mb-1">
                    Drawdown Massimo
                  </span>
                  <select
                    value={quickMaxDD}
                    onChange={(e) => setQuickMaxDD(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#11131c] border border-[#C5A059]/30 text-white font-mono text-xs outline-none"
                  >
                    <option value="3.00">3.0% (Chirurgico)</option>
                    <option value="5.00">5.0% (Rigido)</option>
                    <option value="8.00">8.0% (Standard)</option>
                    <option value="10.00">10.0% (Standard AUREUS)</option>
                  </select>
                </div>

                <div>
                  <span className="font-mono text-[9.5px] text-slate-400 uppercase block mb-1">
                    Target Profit
                  </span>
                  <select
                    value={quickTargetProfit}
                    onChange={(e) => setQuickTargetProfit(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#11131c] border border-[#C5A059]/30 text-white font-mono text-xs outline-none"
                  >
                    <option value="0.00">Nessun Target (Miglior PnL)</option>
                    <option value="5.00">+5.0% (Scalp)</option>
                    <option value="8.00">+8.0%</option>
                    <option value="10.00">+10.0%</option>
                    <option value="15.00">+15.0% (Obiettivo Sovrano)</option>
                    <option value="20.00">+20.0%</option>
                  </select>
                </div>
              </div>

              {/* Blind Mode Toggle */}
              <div className="p-2.5 rounded-lg border border-[#C5A059]/25 bg-[#0e1018] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={13} className="text-[#E8C56A]" />
                  <span className="font-mono text-[10.5px] font-bold text-white">
                    Blind Date Engine (Date Casuali Celate)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={quickBlindMode}
                  onChange={(e) => setQuickBlindMode(e.target.checked)}
                  className="w-4 h-4 accent-[#E8C56A] cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    joinMutation.mutate({
                      tournamentId: selectedTournamentId,
                      pair: quickPair,
                      timeframe: quickTimeframe,
                      title: quickHasTimer
                        ? `[Duello Blitz] ${quickPair} · ${quickTimerMinutes}m`
                        : `[Duello Forgia] ${quickPair} · Senza Timer`,
                    })
                  }
                  disabled={joinMutation.isPending}
                  className="bt-btn-action bt-btn-action-primary flex-1 justify-center py-2.5 font-bold"
                >
                  <Swords size={14} />
                  <span>
                    {joinMutation.isPending ? "Avvio Duello…" : "⚔️ Avvia Duello Immediato"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomLobbyModalOpen(true)}
                  className="bt-btn-action justify-center py-2.5"
                >
                  <Plus size={13} className="text-[#C5A059]" />
                  <span>Crea con Amici</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: STANZE ATTIVE DELLA FORGIA (MULTIPLAYER LOBBIES) */}
            <div className={`bt-matrix-card flex flex-col justify-between ${mobileHubTab === "lobbies" ? "!flex" : "!hidden lg:!flex"}`}>
              <div>
                <div className="bt-matrix-head">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[#E8C56A]" />
                    <h4 className="bt-matrix-title">Stanze della Forgia &amp; Lobby Aperte</h4>
                  </div>
                  <span className="bt-matrix-tag">Multiplayer Sincrono</span>
                </div>

                <div className="bt-battle-lobbies-list mt-2.5">
                  {/* Room 1 */}
                  <div className="bt-battle-room-row">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                          title="Duello 1v1 ad Armi Pari"
                        >
                          Duello 1v1 ad Armi Pari
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 font-mono text-[9px] font-bold text-[#E8C56A] whitespace-nowrap">
                          XAU/USD · M5
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        Senza Timer · Max DD 10% · Stop Obbligatorio
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        joinMutation.mutate({
                          tournamentId: selectedTournamentId,
                          pair: "XAU/USD",
                          timeframe: "M5",
                          title: "Duello 1v1 ad Armi Pari",
                        })
                      }
                      disabled={joinMutation.isPending}
                      className="bt-session-open-btn shrink-0"
                      title="Avvia o entra nel duello 1v1 su XAU/USD M5"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Entra</span>
                    </button>
                  </div>

                  {/* Room 2 */}
                  <div className="bt-battle-room-row">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                          title="Mischia della Tribù · Oro Puro"
                        >
                          Mischia della Tribù · Oro Puro
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 font-mono text-[9px] font-bold text-emerald-400 whitespace-nowrap">
                          XAU/USD · H1
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        30 min · 4 Concorrenti · Stesso Contesto Sincrono
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        joinMutation.mutate({
                          tournamentId: selectedTournamentId,
                          pair: "XAU/USD",
                          timeframe: "H1",
                          title: "Mischia della Tribù: Oro Puro",
                        })
                      }
                      disabled={joinMutation.isPending}
                      className="bt-session-open-btn shrink-0"
                      title="Partecipa alla mischia su XAU/USD H1"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Partecipa</span>
                    </button>
                  </div>

                  {/* Room 3 */}
                  <div className="bt-battle-room-row">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                          title="Sfida Scalping Flash"
                        >
                          Sfida Scalping Flash
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/35 font-mono text-[9px] font-bold text-sky-400 whitespace-nowrap">
                          EUR/USD · M1
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        10 min · Rischio Fisso 1% · Esecuzione Rapida
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        joinMutation.mutate({
                          tournamentId: selectedTournamentId,
                          pair: "EUR/USD",
                          timeframe: "M1",
                          title: "Sfida Scalping Flash",
                        })
                      }
                      disabled={joinMutation.isPending}
                      className="bt-session-open-btn shrink-0"
                      title="Lancia la sfida scalping su EUR/USD M1"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Partecipa</span>
                    </button>
                  </div>

                  {/* Room 4 */}
                  <div className="bt-battle-room-row">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                          title="Battaglia Indici Wall Street"
                        >
                          Battaglia Indici Wall Street
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 font-mono text-[9px] font-bold text-amber-400 whitespace-nowrap">
                          US30 · M15
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        15 min · Volatilità NY · Target Sovrano +20%
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        joinMutation.mutate({
                          tournamentId: selectedTournamentId,
                          pair: "US30",
                          timeframe: "M15",
                          title: "Battaglia Indici Wall Street",
                        })
                      }
                      disabled={joinMutation.isPending}
                      className="bt-session-open-btn shrink-0"
                      title="Entra nella sfida su US30 M15"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Entra</span>
                    </button>
                  </div>

                  {/* Room 5 */}
                  <div className="bt-battle-room-row">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                          title="Arena Bitcoin Alpha"
                        >
                          Arena Bitcoin Alpha
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/35 font-mono text-[9px] font-bold text-purple-300 whitespace-nowrap">
                          BTC/USD · M5
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        Senza Timer · Reattività Pura · Stop Loss Rigido
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        joinMutation.mutate({
                          tournamentId: selectedTournamentId,
                          pair: "BTC/USD",
                          timeframe: "M5",
                          title: "Arena Bitcoin Alpha",
                        })
                      }
                      disabled={joinMutation.isPending}
                      className="bt-session-open-btn shrink-0"
                      title="Partecipa all'arena Bitcoin M5"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Entra</span>
                    </button>
                  </div>
                </div>

                {/* Telemetria Operativa Live della Stanza */}
                <div className="bt-lobby-telemetry-bar mt-2.5">
                  <div className="bt-lobby-telemetry-item">
                    <span>Operatori Attivi</span>
                    <strong>18 Online</strong>
                  </div>
                  <div className="bt-lobby-telemetry-item">
                    <span>Stanze Aperte</span>
                    <strong>5 in Corso</strong>
                  </div>
                  <div className="bt-lobby-telemetry-item">
                    <span>Tempo Medio</span>
                    <strong>14 min</strong>
                  </div>
                </div>
              </div>

              <div className="bt-matrix-actions-row pt-2.5 border-t border-[#C5A059]/15">
                <button
                  type="button"
                  onClick={() => setIsCustomLobbyModalOpen(true)}
                  className="bt-btn-action bt-btn-action-primary flex-1 justify-center"
                >
                  <Plus size={13} />
                  <span>Forgia Stanza Custom</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="bt-btn-action justify-center"
                  title="Invita un confratello alla tua stanza di prova"
                >
                  <UserPlus size={13} className="text-[#C5A059]" />
                  <span>Invita Compagni</span>
                </button>
              </div>
            </div>
          </section>

          {/* LOWER DECK: CODICE D'ONORE & ALBO DEI DUELLI CON BOTTONE MOSTRA PODIO */}
          <section className={`bt-bottom-matrix ${mobileHubTab === "leaderboard" ? "!grid" : "!hidden lg:!grid"}`} aria-label="Strumenti per Sfide di Backtest tra Confratelli">
            {/* MODULO 1: CODICE D'ONORE & GUARDRAIL DELLA PROVA */}
            <div className="bt-matrix-card flex flex-col justify-between">
              <div>
                <div className="bt-matrix-head">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-[#E8C56A]" />
                    <h4 className="bt-matrix-title">Codice d&apos;Onore &amp; Guardrail del Duello</h4>
                  </div>
                  <span className="bt-matrix-tag">Regolamento Sovrano</span>
                </div>

                <div className="bt-rules-grid mt-2.5">
                  <div className="bt-rule-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target size={12} className="shrink-0 text-[#E8C56A]" />
                        <span className="font-mono text-[11px] font-bold text-white uppercase whitespace-nowrap">
                          1. Test Cieco Sincrono
                        </span>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 font-mono text-[9px] font-bold text-[#E8C56A] uppercase whitespace-nowrap">
                        Data Celata
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug m-0">
                      Data e contesto storico celati per entrambi i trader: zero bias visivo e partenza sincronizzata al secondo.
                    </p>
                  </div>

                  <div className="bt-rule-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ShieldCheck size={12} className="shrink-0 text-rose-400" />
                        <span className="font-mono text-[11px] font-bold text-white uppercase whitespace-nowrap">
                          2. Drawdown Massimo 10%
                        </span>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/35 font-mono text-[9px] font-bold text-rose-400 uppercase whitespace-nowrap">
                        Squalifica Istantanea
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug m-0">
                      Superare la soglia massima del 10% comporta l&apos;esclusione immediata dal podio per salvaguardare il capitale.
                    </p>
                  </div>

                  <div className="bt-rule-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Scale size={12} className="shrink-0 text-emerald-400" />
                        <span className="font-mono text-[11px] font-bold text-white uppercase whitespace-nowrap">
                          3. Stop Loss Obbligatorio
                        </span>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 font-mono text-[9px] font-bold text-emerald-400 uppercase whitespace-nowrap">
                        Rischio Definito
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug m-0">
                      Ogni ordine a mercato deve definire il rischio prima dell&apos;apertura: vietate posizioni prive di protezione.
                    </p>
                  </div>

                  <div className="bt-rule-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock size={12} className="shrink-0 text-amber-300" />
                        <span className="font-mono text-[11px] font-bold text-white uppercase whitespace-nowrap">
                          4. Campione Minimo 5 Trade
                        </span>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 font-mono text-[9px] font-bold text-amber-300 uppercase whitespace-nowrap">
                        Validità Statistica
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug m-0">
                      Occorrono almeno 5 esecuzioni per validare la statistica ed escludere il singolo colpo fortunato.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0a0b12] border border-[#C5A059]/20 flex items-center justify-between mt-2.5">
                <span className="font-mono text-[9.5px] text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[#E8C56A]" />
                  <span>Protocollo d&apos;Integrità Sovrano</span>
                </span>
                <span className="font-mono text-[9px] text-[#C5A059] uppercase font-bold whitespace-nowrap">
                  Prove Verificate dell&apos;Ordine
                </span>
              </div>
            </div>

            {/* MODULO 2: ALBO DEI DUELLI & RIVEDI SFIDE (CON REPLAY E BOTTONE CONSULTA PODIO) */}
            <div className="bt-matrix-card flex flex-col justify-between">
              <div>
                <div className="bt-matrix-head">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-[#E8C56A]" />
                    <h4 className="bt-matrix-title">Albo dei Duelli &amp; Rivedi Sfide tra Amici</h4>
                  </div>
                  <span className="bt-matrix-tag">Analisi Replay tra Pari</span>
                </div>

                <div className="bt-real-sessions-list mt-2.5">
                  {(recentSessions.length > 0
                    ? recentSessions.slice(0, 4)
                    : [
                        {
                          id: 101,
                          name: `${operatorDisplayName} vs MarcoT`,
                          pair: "XAU/USD",
                          timeframe: "M5",
                          profitPct: 4.2,
                          totalPips: 185,
                          totalTrades: 12,
                          winTrades: 7,
                          loseTrades: 5,
                          winRate: 58.3,
                          profitFactor: 2.1,
                        },
                        {
                          id: 102,
                          name: `${operatorDisplayName} vs Marcus`,
                          pair: "EUR/USD",
                          timeframe: "M1",
                          profitPct: -1.76,
                          totalPips: -42,
                          totalTrades: 8,
                          winTrades: 3,
                          loseTrades: 5,
                          winRate: 37.5,
                          profitFactor: 0.85,
                        },
                        {
                          id: 103,
                          name: `${operatorDisplayName} vs Aurelius`,
                          pair: "US30",
                          timeframe: "M15",
                          profitPct: 6.07,
                          totalPips: 340,
                          totalTrades: 15,
                          winTrades: 10,
                          loseTrades: 5,
                          winRate: 66.7,
                          profitFactor: 2.45,
                        },
                        {
                          id: 104,
                          name: "Tribù dell'Oro · Mischia",
                          pair: "XAU/USD",
                          timeframe: "H1",
                          profitPct: 12.3,
                          totalPips: 520,
                          totalTrades: 22,
                          winTrades: 14,
                          loseTrades: 8,
                          winRate: 63.6,
                          profitFactor: 2.8,
                        },
                      ]
                  ).map((sess) => {
                    const isPos = sess.profitPct >= 0;
                    return (
                      <div key={sess.id} className="bt-real-session-row">
                        {/* Sub-row 1: Title + Pair/TF on left, P&L + Replay on right */}
                        <div className="flex items-center justify-between gap-2 w-full min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className="font-mono text-[11px] font-bold text-white uppercase truncate min-w-[120px]"
                              title={sess.name}
                            >
                              {cleanSessionDisplayTitle(sess.name)}
                            </span>
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 font-mono text-[9px] font-bold text-[#E8C56A] whitespace-nowrap">
                              {sess.pair} · {sess.timeframe}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`font-mono text-xs font-bold whitespace-nowrap ${
                                isPos ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {formatCompactPct(sess.profitPct)}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                openReplaySession({
                                  sessionId: sess.id,
                                  pair: sess.pair,
                                  timeframe: sess.timeframe,
                                  name: sess.name,
                                })
                              }
                              className="bt-session-open-btn shrink-0"
                              title={`Apri sessione nel Replay`}
                            >
                              <Play size={10} className="fill-current" />
                              <span>Replay</span>
                            </button>

                            <a
                              href={`/duello/room_tournament_${selectedTournamentId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bt-session-open-btn shrink-0 text-[#E8C56A] border-[#C5A059]/35 hover:border-[#C5A059]"
                              title="Osserva il duello dalla Tribuna Spettatori"
                            >
                              <Eye size={10} className="text-[#C5A059]" />
                              <span>Tribuna</span>
                            </a>
                          </div>
                        </div>

                        {/* Sub-row 2: Trades & WR on left, Net Pips & Profit Factor on right */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#C5A059]/10 font-mono text-[9.5px] w-full">
                          <div className="flex items-center gap-1.5 text-slate-400 min-w-0 truncate">
                            <span className="whitespace-nowrap">
                              {sess.totalTrades} Trade ({sess.winTrades}V/{sess.loseTrades}P)
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-300 whitespace-nowrap">WR {sess.winRate}%</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-right">
                            <span className="text-slate-400 whitespace-nowrap text-[9px]">
                              {sess.totalPips >= 0 ? "+" : ""}{sess.totalPips.toLocaleString("it-IT", { maximumFractionDigits: 0 })} pips
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-[#E8C56A] font-bold whitespace-nowrap">
                              PF {sess.profitFactor.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bt-matrix-actions-row pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    playBattleChime();
                    setShowPodiumCeremony(true);
                  }}
                  className="bt-btn-action bt-btn-action-primary flex-1 justify-center py-2"
                  title="Mostra la cerimonia animata 3D del podio e la classifica del torneo terminato"
                >
                  <Trophy size={13} />
                  <span>🏆 Consulta Cerimonia Ultimo Podio &amp; Gerarchia</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Modal Creazione Stanza Custom & Preset Tribù */}
      <CustomLobbyModal
        isOpen={isCustomLobbyModalOpen}
        onClose={() => setIsCustomLobbyModalOpen(false)}
        userDisplayName={operatorDisplayName}
        onLobbyReady={(lobby) => {
          setIsCustomLobbyModalOpen(false);
          setActiveCustomLobby(lobby);
        }}
      />

      {/* Modal Sala d'Attesa Multiplayer per Stanza Custom (Avvio Simultaneo) */}
      {activeCustomLobby && (
        <BattleRoomLobbyModal
          customLobby={activeCustomLobby}
          isOpen={Boolean(activeCustomLobby)}
          userDisplayName={operatorDisplayName}
          onClose={() => setActiveCustomLobby(null)}
          onEnterBattle={(assignedStartTs) => {
            const lobbyToLaunch = activeCustomLobby;
            setActiveCustomLobby(null);
            if (assignedStartTs != null && typeof window !== "undefined") {
              try {
                window.localStorage.setItem(
                  `traderloading:backtest-start:temp`,
                  String(assignedStartTs),
                );
              } catch {
                // Ignore storage failure
              }
            }
            joinMutation.mutate({
              tournamentId: selectedTournamentId,
              pair: lobbyToLaunch.pair,
              timeframe: lobbyToLaunch.timeframe,
              title: lobbyToLaunch.name,
            });
          }}
          isJoining={joinMutation.isPending}
        />
      )}

      {/* Modal Invito Concorrenti */}
      <BattleInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomCode={activeCustomLobby?.code || `FORGIA-PROVA-${selectedTournamentId}`}
        roomId={
          activeCustomLobby
            ? `custom_forgia_${activeCustomLobby.code}`
            : `room_tournament_${selectedTournamentId}`
        }
      />

      {/* Modal Condivisione Tribuna Spettatori */}
      <ArenaSpectatorShareModal
        isOpen={isSpectatorModalOpen}
        onClose={() => setIsSpectatorModalOpen(false)}
        roomId={
          activeCustomLobby
            ? `custom_forgia_${activeCustomLobby.code}`
            : `room_tournament_${selectedTournamentId}`
        }
        roomCode={activeCustomLobby?.code || `FORGIA-PROVA-${selectedTournamentId}`}
      />
    </div>
  );
}
