import { useEffect, useRef, useState } from "react";
import {
  createMarketBreakerEngine,
  type MarketBreakerController,
} from "./marketBreakerEngine";
import { gameAudio } from "./gameAudioSynthesizer";
import {
  loadChroniclesPersistence,
  saveChroniclesPersistence,
} from "./chronicles/chroniclesCampaignData";
import { addMasterAurei } from "./unifiedArcadeStore";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Flame,
  Trophy,
  ArrowLeft,
  ArrowRight,
  Coins,
  Heart,
  ChevronRight,
  Layers,
  Sparkles,
} from "lucide-react";

interface MarketBreakerGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
  };
}

const MARKET_CORRIDORS = [
  {
    id: 1,
    name: "Corridoio I · Forex Range (EUR/USD)",
    desc: "Infrangi i blocchi di resistenza ask e libera il pool di liquidità verde.",
    reward: 120,
  },
  {
    id: 2,
    name: "Corridoio II · Muraglia di Wall Street (S&P 500)",
    desc: "Blocchi istituzionali corazzati. Richiedono doppio impatto per cedere.",
    reward: 180,
  },
  {
    id: 3,
    name: "Corridoio III · Fossa Crypto (Alta Volatilità)",
    desc: "Presenza di Cigni Neri esplosivi. Innesca reazioni a catena tra i blocchi.",
    reward: 250,
  },
  {
    id: 4,
    name: "Corridoio IV · Il Caveau delle Commodities (Gold/Oil)",
    desc: "Alta densità di ordini limite e barriere di contenimento massivo.",
    reward: 320,
  },
  {
    id: 5,
    name: "Corridoio V · Il Breakout Sovrano (Grand Order Book)",
    desc: "L'intera profondità del mercato. Distruggi l'intero book per consacrare la vittoria.",
    reward: 500,
  },
];

export function MarketBreakerGame({ onClose, activeTradeContext }: MarketBreakerGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MarketBreakerController | null>(null);

  const [chronicles, setChronicles] = useState(() => loadChroniclesPersistence());
  const [level, setLevel] = useState(1);
  const currentCorridor = MARKET_CORRIDORS[level - 1] || MARKET_CORRIDORS[0];

  const [gameState, setGameState] = useState<"ready" | "running" | "paused" | "over" | "victory">("ready");
  const [score, setScore] = useState(0);
  const [bricksLeft, setBricksLeft] = useState(28);
  const [lives, setLives] = useState(3);
  const [aurei, setAurei] = useState(0);
  const [isAudioOn, setIsAudioOn] = useState(() => gameAudio.isEnabled());

  useEffect(() => {
    if (!containerRef.current) return;

    const controller = createMarketBreakerEngine(
      containerRef.current,
      {
        onScoreUpdate: (data) => {
          setScore(data.score);
          setBricksLeft(data.bricksLeft);
          setLives(data.lives);
          setAurei(data.aurei);
        },
        onLevelClear: (lvl, earned) => {
          addMasterAurei(earned);
          const updated = saveChroniclesPersistence({
            totalAureiWallet: chronicles.totalAureiWallet + earned,
          });
          setChronicles(updated);
          setGameState("victory");
        },
        onGameOver: () => {
          setGameState("over");
        },
        onStateChange: (state) => setGameState(state),
      },
      level,
    );

    controllerRef.current = controller;

    return () => {
      controller?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleStart = () => {
    controllerRef.current?.setLevel(level);
    controllerRef.current?.start();
    setGameState("running");
  };

  const handlePause = () => {
    controllerRef.current?.pause();
    setGameState("paused");
  };

  const handleResume = () => {
    controllerRef.current?.resume();
    setGameState("running");
  };

  const handleRestart = () => {
    controllerRef.current?.restart();
    setGameState("running");
  };

  const handleNextCorridor = () => {
    if (level < 5) {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      controllerRef.current?.setLevel(nextLvl);
      setGameState("ready");
    }
  };

  const toggleSound = () => {
    const next = gameAudio.toggle();
    setIsAudioOn(next);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] select-none overflow-hidden bg-[#07080b] rounded-xl border border-[#C5A059]/25 flex flex-col justify-between font-mono">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* Top HUD */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Score & Lives */}
        <div className="flex items-center gap-3">
          <div className="bg-[#0d0f14]/85 backdrop-blur-md border border-[#C5A059]/30 rounded-lg px-3 py-1.5 shadow-[0_0_15px_rgba(197,160,89,0.1)]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Punteggio Order Book
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#E8C56A] tabular-nums tracking-tight whitespace-nowrap">
              {score.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                size={14}
                className={i < lives ? "text-red-500 fill-red-500" : "text-white/20"}
              />
            ))}
          </div>
        </div>

        {/* Center: Corridor & Bricks Remaining */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="bg-black/80 backdrop-blur-md border border-[#C5A059]/30 rounded-full px-4 py-1 flex items-center gap-2.5 text-xs">
            <Layers size={13} className="text-[#E8C56A]" />
            <span className="text-muted-foreground">Blocchi d'Ordine Rimasti:</span>
            <strong className="text-foreground tabular-nums whitespace-nowrap">{bricksLeft}</strong>
          </div>
        </div>

        {/* Right: Aurei & Audio Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#0d0f14]/85 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-[#E8C56A]">
              <Coins size={13} />
              <span className="font-bold tabular-nums whitespace-nowrap">{aurei}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            title={isAudioOn ? "Silenzia audio" : "Attiva audio"}
            className="p-2 rounded-lg bg-[#0d0f14]/85 border border-white/10 hover:border-[#C5A059]/40 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
          >
            {isAudioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {gameState === "running" && (
            <button
              type="button"
              onClick={handlePause}
              title="Pausa"
              className="p-2 rounded-lg bg-[#0d0f14]/85 border border-white/10 hover:border-[#C5A059]/40 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
            >
              <Pause size={16} />
            </button>
          )}
        </div>
      </div>

      {/* SCREEN: READY & CORRIDOR SELECT */}
      {gameState === "ready" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-xl w-full bg-[#0d0f14] border border-[#C5A059]/35 rounded-2xl p-5 sm:p-6 shadow-[0_0_40px_rgba(197,160,89,0.18)] flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-[10px] uppercase font-bold tracking-wider mx-auto">
              <Layers size={13} />
              <span>MARKET BREAKER 3D · PROFONDITÀ DEL BOOK</span>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {currentCorridor.name}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentCorridor.desc}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Comandi:</span>
                <strong className="text-foreground">Mouse / Touch orizzontale o A / D</strong>
              </div>
              <div className="flex justify-between">
                <span>Laser (se attivo):</span>
                <strong className="text-[#E8C56A]">Barra Spaziatrice</strong>
              </div>
              <div className="flex justify-between">
                <span>Ricompensa Breakout:</span>
                <strong className="text-emerald-400">+{currentCorridor.reward} Aurei</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStart}
              className="w-full py-3 px-6 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={15} fill="currentColor" />
              <span>Lancia Sfera di Liquidità</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN: VICTORY SCREEN */}
      {gameState === "victory" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center">
          <div className="max-w-md w-full bg-[#0d0f14] border border-[#C5A059] rounded-2xl p-6 shadow-[0_0_50px_rgba(197,160,89,0.25)] flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059] mx-auto flex items-center justify-center text-[#E8C56A]">
              <Trophy size={28} />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Breakout Istituzionale Eseguito
              </span>
              <h2 className="text-lg font-bold text-foreground mt-1">
                {currentCorridor.name}
              </h2>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Hai distrutto l'intero book di resistenza, incassando{" "}
              <strong className="text-[#E8C56A]">+{currentCorridor.reward} Aurei</strong>.
            </p>

            <div className="space-y-2 mt-2">
              {level < 5 && (
                <button
                  type="button"
                  onClick={handleNextCorridor}
                  className="w-full py-3 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <span>Prossimo Corridoio</span>
                  <ChevronRight size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setGameState("ready")}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                Torna al Selettore Livelli
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN: GAME OVER */}
      {gameState === "over" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center">
          <div className="max-w-sm w-full bg-[#0d0f14] border border-red-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-foreground">SFERA PERDUTA</h3>
            <p className="text-xs text-muted-foreground">
              Le resistenze hanno respinto la spinta. Rimetti a punto il sestante.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                <span>Riprova Corridoio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAUSED OVERLAY */}
      {gameState === "paused" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
          <div className="max-w-xs w-full bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-6 shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-foreground">PARTITA SOSPESA</h3>
            <button
              type="button"
              onClick={handleResume}
              className="w-full py-2.5 px-4 rounded-xl bg-[#C5A059] text-black font-bold text-xs cursor-pointer hover:bg-[#d8b167]"
            >
              Riprendi
            </button>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls for Paddle */}
      <div className="relative z-10 p-3 flex sm:hidden items-center justify-between pointer-events-auto bg-black/40 border-t border-white/5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => controllerRef.current?.movePaddle(-1.2)}
            className="w-12 h-11 rounded-lg bg-[#0d0f14] border border-[#C5A059]/30 active:bg-[#C5A059]/20 flex items-center justify-center text-[#E8C56A]"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => controllerRef.current?.movePaddle(1.2)}
            className="w-12 h-11 rounded-lg bg-[#0d0f14] border border-[#C5A059]/30 active:bg-[#C5A059]/20 flex items-center justify-center text-[#E8C56A]"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => controllerRef.current?.fireLasers()}
          className="px-4 h-11 rounded-lg bg-red-950/60 border border-red-500/50 active:bg-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5"
        >
          <Zap size={14} />
          <span>Laser</span>
        </button>
      </div>
    </div>
  );
}
