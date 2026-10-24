import { useState } from "react";
import { TacticalCockpitGame } from "../tacticalCockpit/TacticalCockpitGame";
import { RiskTableGame } from "../RiskTableGame";
import { TacticalChessGame } from "../tacticalChess/TacticalChessGame";
import { FluidArchitectGame } from "../fluidArchitect/FluidArchitectGame";
import { BullRunnerGame } from "../BullRunnerGame";
import { MarketBreakerGame } from "../MarketBreakerGame";
import { ChroniclesSkillTreeModal } from "./ChroniclesSkillTreeModal";
import {
  loadChroniclesPersistence,
} from "./chroniclesCampaignData";
import { loadRiskTablePersistence } from "../riskTableData";
import { loadChessPersistence } from "../tacticalChess/chessEngine";
import { loadFluidPersistence } from "../fluidArchitect/fluidEngine";
import { loadCockpitPersistence } from "../tacticalCockpit/cockpitEngine";
import { loadMasterVault } from "../unifiedArcadeStore";
import { gameAudio } from "../gameAudioSynthesizer";
import {
  Gamepad2,
  Layers,
  Sparkles,
  Trophy,
  Shield,
  Coins,
  Clock,
  Compass,
  Crown,
  ShieldCheck,
  Zap,
  Droplet,
  Volume2,
  VolumeX,
  Crosshair,
} from "lucide-react";

interface ChroniclesHubProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function ChroniclesHub({ onClose, activeTradeContext }: ChroniclesHubProps) {
  const [activeTab, setActiveTab] = useState<
    "chess3d" | "cockpit3d" | "risk3d" | "fluid3d" | "runner3d" | "breaker3d" | "stats"
  >("chess3d");
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [saveData, setSaveData] = useState(() => loadChroniclesPersistence());
  const [riskData, setRiskData] = useState(() => loadRiskTablePersistence());
  const [chessData, setChessData] = useState(() => loadChessPersistence());
  const [fluidData, setFluidData] = useState(() => loadFluidPersistence());
  const [cockpitData, setCockpitData] = useState(() => loadCockpitPersistence());
  const [isAudioOn, setIsAudioOn] = useState(() => gameAudio.isEnabled());

  const toggleSound = () => {
    const next = gameAudio.toggle();
    setIsAudioOn(next);
  };

  const handleTabChange = (
    tab: "chess3d" | "cockpit3d" | "risk3d" | "fluid3d" | "runner3d" | "breaker3d" | "stats"
  ) => {
    setActiveTab(tab);
    setSaveData(loadChroniclesPersistence());
    setRiskData(loadRiskTablePersistence());
    setChessData(loadChessPersistence());
    setFluidData(loadFluidPersistence());
    setCockpitData(loadCockpitPersistence());
  };

  const formatDetachmentTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} ore`;
  };

  return (
    <div className="w-full h-full flex flex-col justify-between font-mono select-none overflow-hidden text-foreground">
      {/* Sub-Header & 3D Game Experience Switcher */}
      <div className="p-2 sm:p-3 bg-[#0d0f14] border-b border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/10 rounded-xl overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => handleTabChange("chess3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "chess3d"
                ? "bg-[#C5A059] text-black shadow-md font-extrabold"
                : "text-[#E8C56A] hover:bg-[#C5A059]/10"
            }`}
          >
            <Crown size={14} className={activeTab === "chess3d" ? "text-black" : "text-[#C5A059]"} />
            <span>Scacchi dell'Ordine (3D)</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-[#E8C56A] uppercase font-bold tracking-wider">
              10 Puzzle & IA
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("cockpit3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "cockpit3d"
                ? "bg-[#C5A059] text-black shadow-md font-extrabold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Crosshair size={14} />
            <span>Cockpit Tattico (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("risk3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "risk3d"
                ? "bg-[#C5A059] text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={14} />
            <span>Banco del Rischio (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("fluid3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "fluid3d"
                ? "bg-[#C5A059] text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Droplet size={14} />
            <span>Architetto dei Flussi (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("runner3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "runner3d"
                ? "bg-[#C5A059] text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gamepad2 size={14} />
            <span>Bull Runner (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("breaker3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "breaker3d"
                ? "bg-[#C5A059] text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={14} />
            <span>Market Breaker (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("stats")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "stats"
                ? "bg-[#C5A059] text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy size={14} />
            <span className="hidden sm:inline">Registro Conquiste</span>
          </button>
        </div>

        {/* Global Controls: Audio Switch & Arsenal Master Aurei Vault */}
        <div className="flex items-center gap-2">
          {/* Procedural Audio Mute Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
            title={isAudioOn ? "Disattiva Audio di Gioco" : "Attiva Audio Procedurale WebAudio"}
          >
            {isAudioOn ? <Volume2 size={15} /> : <VolumeX size={15} className="text-rose-400" />}
          </button>

          {/* Master Arsenal Quick Trigger */}
          <button
            type="button"
            onClick={() => setSkillModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/25 text-[#E8C56A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            title="Apri l'Albero dei Talenti e Spendi Aurei"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Arsenale:</span>
            <span className="tabular-nums font-mono">{loadMasterVault().masterAurei} Aurei</span>
          </button>
        </div>
      </div>

      {/* Main 3D Viewport Content */}
      <div className="flex-1 min-h-0 relative">
        {activeTab === "cockpit3d" && (
          <TacticalCockpitGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "risk3d" && (
          <RiskTableGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "chess3d" && (
          <TacticalChessGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "fluid3d" && (
          <FluidArchitectGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "runner3d" && (
          <BullRunnerGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "breaker3d" && (
          <MarketBreakerGame onClose={onClose} activeTradeContext={activeTradeContext} />
        )}

        {activeTab === "stats" && (
          <div className="p-4 sm:p-8 max-w-3xl mx-auto h-full overflow-y-auto space-y-6 text-xs">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-foreground tracking-tight uppercase">
                Registro del Distacco Operativo (3D)
              </h2>
              <p className="text-muted-foreground text-xs">
                Archivio delle conquiste psicologiche e della disciplina lontano dal grafico.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-black/40 border border-[#C5A059]/40 space-y-1">
                <span className="text-[10px] uppercase text-[#C5A059] font-bold block">Scenari Cockpit (3D)</span>
                <strong className="text-base font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
                  {cockpitData.completedScenarioIds.length} / 7 Ere
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground block">Fold Tattici Conscio</span>
                <strong className="text-base font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                  {cockpitData.totalDisciplinedFolds} Fold
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground block">Grado Scacchi Elo</span>
                <strong className="text-base font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
                  {chessData.playerElo} Elo
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground block">Flusso Canalizzato</span>
                <strong className="text-base font-bold text-cyan-400 tabular-nums whitespace-nowrap">
                  {fluidData.totalLitersChanneled} Litri
                </strong>
              </div>
            </div>

            {/* Badges of Honor */}
            <div className="p-4 rounded-xl bg-black/40 border border-[#C5A059]/25 space-y-3">
              <div className="flex items-center gap-2 font-bold text-[#E8C56A]">
                <Shield size={15} />
                <span>Sigilli di Integrità Conquistati (3D)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div
                  className={`p-3 rounded-lg border text-left ${
                    fluidData.totalLitersChanneled >= 80
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                      : "bg-black/20 border-white/5 text-muted-foreground/40 opacity-60"
                  }`}
                >
                  <strong className="text-xs block">Maestro dei Flussi</strong>
                  <span className="text-[10px] text-muted-foreground">Primo circuito 3D canalizzato</span>
                </div>

                <div
                  className={`p-3 rounded-lg border text-left ${
                    chessData.completedPuzzleIds.length >= 1
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                      : "bg-black/20 border-white/5 text-muted-foreground/40 opacity-60"
                  }`}
                >
                  <strong className="text-xs block">L'Oracolo di Wyckoff</strong>
                  <span className="text-[10px] text-muted-foreground">Primo puzzle 3D risolto</span>
                </div>

                <div
                  className={`p-3 rounded-lg border text-left ${
                    riskData.totalDisciplinedFolds >= 3
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                      : "bg-black/20 border-white/5 text-muted-foreground/40 opacity-60"
                  }`}
                >
                  <strong className="text-xs block">La Mano Ferma</strong>
                  <span className="text-[10px] text-muted-foreground">3+ Fold Conscio disciplinati</span>
                </div>

                <div
                  className={`p-3 rounded-lg border text-left ${
                    saveData.completedChapters.includes(4)
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                      : "bg-black/20 border-white/5 text-muted-foreground/40 opacity-60"
                  }`}
                >
                  <strong className="text-xs block">Flagello del Titano</strong>
                  <span className="text-[10px] text-muted-foreground">Titano abbattuto in 3D</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Skill Tree Modal */}
      <ChroniclesSkillTreeModal
        open={skillModalOpen}
        onOpenChange={setSkillModalOpen}
        onSkillsUpdated={(newSkills, newWallet) => {
          setSaveData((prev) => ({
            ...prev,
            bullSkills: newSkills,
            totalAureiWallet: newWallet,
          }));
        }}
      />
    </div>
  );
}
