import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Volume2,
  VolumeX,
  Volume1,
  Sparkles,
  Shield,
  Flame,
  AlertTriangle,
  Trophy,
  Crosshair,
  Headphones,
  Swords,
  Zap,
  Heart,
  ShieldAlert,
  Eye,
  Activity,
  Play,
  Square,
} from "lucide-react";
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  soundClick,
  synestheticClick,
  synestheticCheck,
  synestheticConfirm,
  synestheticAlert,
  synestheticTrophy,
  synestheticSealOfAction,
  synestheticArenaTradeWin,
  synestheticArenaDisqualification,
  synestheticArenaLaunch,
  isDeepWorkAmbienceActive,
  toggleDeepWorkAmbience,
  isHeartbeatSoundMuted,
  setHeartbeatSoundMuted,
  getHeartbeatVolume,
  setHeartbeatVolume,
  getStopLossProximityThreshold,
  setStopLossProximityThreshold,
  isVignetteOverlayEnabled,
  setVignetteOverlayEnabled,
  startProceduralHeartbeat,
  stopProceduralHeartbeat,
} from "@/lib/soundFx";

export function SoundFxSettings() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());
  const [volume, setVolumeState] = useState(() => Math.round(getSoundVolume() * 100));
  const [ambienceActive, setAmbienceActive] = useState(() => isDeepWorkAmbienceActive());
  const [heartbeatMuted, setHeartbeatMutedState] = useState(() => isHeartbeatSoundMuted());
  const [heartbeatVol, setHeartbeatVolState] = useState(() => Math.round(getHeartbeatVolume() * 100));
  const [slThreshold, setSlThresholdState] = useState(() => Math.round(getStopLossProximityThreshold() * 100));
  const [vignetteEnabled, setVignetteEnabledState] = useState(() => isVignetteOverlayEnabled());
  const [testHeartbeatBpm, setTestHeartbeatBpm] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      stopProceduralHeartbeat();
    };
  }, []);

  const handleToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    setEnabled(checked);
    if (checked) {
      synestheticClick();
    }
  };

  const handleVolumeChange = (newVal: number) => {
    setVolumeState(newVal);
    setSoundVolume(newVal / 100);
  };

  const handleVolumeCommit = () => {
    if (enabled) {
      soundClick();
    }
  };

  const handleHeartbeatMuteToggle = (checked: boolean) => {
    synestheticClick();
    setHeartbeatSoundMuted(!checked);
    setHeartbeatMutedState(!checked);
  };

  const handleHeartbeatVolChange = (newVal: number) => {
    setHeartbeatVolState(newVal);
    setHeartbeatVolume(newVal / 100);
  };

  const handleSlThresholdChange = (newPct: number) => {
    synestheticClick();
    setSlThresholdState(newPct);
    setStopLossProximityThreshold(newPct / 100);
  };

  const handleVignetteToggle = (checked: boolean) => {
    synestheticClick();
    setVignetteOverlayEnabled(checked);
    setVignetteEnabledState(checked);
  };

  const handleToggleTestHeartbeat = (bpm: number, intensity: number) => {
    synestheticClick();
    if (testHeartbeatBpm === bpm) {
      stopProceduralHeartbeat();
      setTestHeartbeatBpm(null);
    } else {
      startProceduralHeartbeat(bpm, intensity);
      setTestHeartbeatBpm(bpm);
    }
  };

  const soundProfiles = [
    {
      id: "click",
      title: "Il Tocco d'Ossidiana",
      description: "Micro-scatto d'alta precisione (1900 Hz / 540 Hz). Smorzamento secco senza dispersione.",
      action: synestheticClick,
      icon: Sparkles,
      accent: "border-[#C5A059]/30 text-[#E8C56A] hover:bg-[#C5A059]/10",
      chip: "Micro-Scatto • 24ms",
    },
    {
      id: "check",
      title: "Il Rintocco dell'Integrità",
      description: "Campana Solfeggio a 528 Hz con micro-battimento Alpha (+1.4 Hz) per rilassamento e focus.",
      action: synestheticCheck,
      icon: Shield,
      accent: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
      chip: "528Hz • Alpha 1.4Hz",
    },
    {
      id: "confirm",
      title: "Il Sigillo di Fuoco",
      description: "Fioritura corale ad accordo aureo (216Hz, 324Hz, 432Hz, 540Hz). Convalida solenne.",
      action: synestheticConfirm,
      icon: Flame,
      accent: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
      chip: "Accordo Aureo • 432Hz",
    },
    {
      id: "alert",
      title: "L'Avviso del Custode",
      description: "Rintocco di gong di bronzo a 108 Hz con sub-body a 54 Hz. Arresta la Deriva emotiva.",
      action: synestheticAlert,
      icon: AlertTriangle,
      accent: "border-rose-500/30 text-rose-400 hover:bg-rose-500/10",
      chip: "Gong 108Hz • Sub 54Hz",
    },
    {
      id: "seal_of_action",
      title: "Il Sigillo d'Azione",
      description: "Impatto d'incudine su fondamentale aurea a 432 Hz e sub-basso a 72 Hz. Esecuzione priva di esitazione.",
      action: synestheticSealOfAction,
      icon: Crosshair,
      accent: "border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/15",
      chip: "Sigillo 432Hz • Sub 72Hz",
    },
    {
      id: "trophy",
      title: "L'Apoteosi",
      description: "Cattedrale sospesa a 6 voci pure (C3–G3–C4–E4–G4–D5). Risonanza imperiale di vittoria.",
      action: synestheticTrophy,
      icon: Trophy,
      accent: "border-[#C5A059]/50 text-[#F3D88C] hover:bg-[#C5A059]/15",
      chip: "6 Voci Pure • 1.4s",
    },
    {
      id: "arena_launch",
      title: "Lancio dell'Arena",
      description: "Fanfara aurea ascendente (216Hz -> 432Hz -> 864Hz). Ingresso solenne nel duello a tempo.",
      action: synestheticArenaLaunch,
      icon: Swords,
      accent: "border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/15",
      chip: "Fanfara 216-864Hz",
    },
    {
      id: "arena_win",
      title: "Rintocco di Vittoria Sfidante",
      description: "Doppia risonanza pitagorica a 432 Hz e 864 Hz con shimmer cristallino su operazione a target.",
      action: () => synestheticArenaTradeWin(true),
      icon: Zap,
      accent: "border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10",
      chip: "432Hz + 864Hz",
    },
    {
      id: "arena_disqualification",
      title: "Gong del Giudizio",
      description: "Gong solenne a 144 Hz con decadimento profondo. Squalifica per violazione del drawdown.",
      action: synestheticArenaDisqualification,
      icon: AlertTriangle,
      accent: "border-rose-500/35 text-rose-400 hover:bg-rose-500/10",
      chip: "Gong 144Hz • Sub 72Hz",
    },
    {
      id: "heartbeat_calm",
      title: "Il Ritmo Vitale (Calma)",
      description: "Pulsazione tellurica ventricolare (54 Hz / 36 Hz) a 60 BPM. Sintonizzazione fisiologica di base.",
      action: () => {
        synestheticClick();
        startProceduralHeartbeat(60, 0.1);
        setTimeout(stopProceduralHeartbeat, 3000);
      },
      icon: Heart,
      accent: "border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10",
      chip: "Sub 54Hz • 60 BPM",
    },
    {
      id: "heartbeat_stress",
      title: "Il Ritmo della Soglia (Stress)",
      description: "Accelerazione dinamica (98 BPM) con accento ventricolare. Allerta immediata su avvicinamento allo Stop Loss.",
      action: () => {
        synestheticClick();
        startProceduralHeartbeat(98, 0.85);
        setTimeout(stopProceduralHeartbeat, 3000);
      },
      icon: ShieldAlert,
      accent: "border-rose-500/35 text-rose-400 hover:bg-rose-500/10",
      chip: "Sub 54Hz • 98 BPM",
    },
  ] as const;

  return (
    <Card className="border border-[#C5A059]/25 bg-[#0d0f14] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <CardHeader className="pb-3 border-b border-[#C5A059]/15">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-display uppercase tracking-wider text-[#E8C56A]">
              {enabled ? (
                <Volume2 className="w-4 h-4 text-[#C5A059] shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span>Sinestesia Operativa (Web Audio a Zero Byte)</span>
            </CardTitle>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Ingegneria acustica rilassante e concentrativa (432 Hz, 528 Hz, 108 Hz) fusa con il Motore Aptico.
              Sintesi procedurale in tempo reale a latenza zero.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label="Abilita suoni operativi di sistema"
            className="shrink-0 data-[state=checked]:bg-[#C5A059]"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Controllo Volume / Intensità Imperiale */}
        <div className="rounded-lg border border-[#C5A059]/20 bg-[#07080b]/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-black/60 border border-[#C5A059]/25 text-[#C5A059]">
              {volume === 0 || !enabled ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : volume < 50 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <span className="font-display text-xs uppercase font-bold tracking-wider text-[#E8C56A] block">
                Intensità Feedback Acustico
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                Regolazione lineare del guadagno master
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-56">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              disabled={!enabled}
              value={enabled ? volume : 0}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              onMouseUp={handleVolumeCommit}
              onTouchEnd={handleVolumeCommit}
              aria-label="Volume effetti acustici operativi"
              className="w-full h-1.5 bg-[#1a1d26] rounded-lg appearance-none cursor-pointer accent-[#C5A059] disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <span className="font-mono text-xs font-bold text-[#E8C56A] min-w-[38px] text-right tabular-nums whitespace-nowrap">
              {enabled ? `${volume}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Banner Atmosfera Deep Work 432 Hz */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#C5A059]/35 bg-gradient-to-r from-[#12141f] to-[#0c0d14] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A]">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xs uppercase font-bold tracking-wider text-[#F4F4F6]">
                  Atmosfera Acustica Deep Work
                </span>
                <span
                  className={`font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                    ambienceActive
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-slate-700 bg-slate-800/40 text-slate-400"
                  }`}
                >
                  {ambienceActive ? "IN RIPRODUZIONE" : "STANDBY"}
                </span>
              </div>
              <span className="font-mono text-[10.5px] text-slate-400 block mt-0.5">
                Drone continuo a 432 Hz + micro-battimento Alpha 1.4 Hz per eliminare distrazioni
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Switch
              checked={ambienceActive}
              onCheckedChange={() => {
                synestheticClick();
                const next = toggleDeepWorkAmbience();
                setAmbienceActive(next);
              }}
              disabled={!enabled}
              aria-label="Attiva o disattiva atmosfera acustica continua 432 Hz"
            />
          </div>
        </div>

        {/* Deck Bio-Telemetria & Replay Psicoacustico */}
        <div className="rounded-xl border border-[#C5A059]/30 bg-[#07080b]/95 p-4 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]">
                <Heart className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs uppercase font-bold tracking-wider text-[#F4F4F6]">
                    Bio-Telemetria Cardiaca &amp; Replay
                  </span>
                  <span
                    className={`font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                      !heartbeatMuted
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                        : "border-slate-700 bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    {!heartbeatMuted ? "ATTIVO" : "SILENZIATO"}
                  </span>
                </div>
                <span className="font-mono text-[10.5px] text-slate-400 block mt-0.5">
                  Doppia pulsazione ventricolare sub-tellurica (54 Hz &rarr; 36 Hz) sincronizzata con la prossimità a Stop Loss
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Switch
                checked={!heartbeatMuted}
                onCheckedChange={handleHeartbeatMuteToggle}
                disabled={!enabled}
                aria-label="Attiva o disattiva audio bio-telemetrico del battito cardiaco"
              />
            </div>
          </div>

          {/* Sottosezione Slider Volume Sub-Bass & Soglia Stop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Slider Guadagno Sub-Bass */}
            <div className="rounded-lg border border-white/5 bg-black/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#E8C56A]">
                  Guadagno Sub-Bass Ventricolare
                </span>
                <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">
                  {heartbeatVol}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                disabled={!enabled || heartbeatMuted}
                value={heartbeatVol}
                onChange={(e) => handleHeartbeatVolChange(Number(e.target.value))}
                aria-label="Volume sub-bass battito cardiaco"
                className="w-full h-1.5 bg-[#1a1d26] rounded-lg appearance-none cursor-pointer accent-[#C5A059] disabled:opacity-30 disabled:cursor-not-allowed"
              />
              <span className="font-mono text-[9.5px] text-slate-500 block">
                Profondità tellurica dell&apos;impatto delle valvole atrio-ventricolari
              </span>
            </div>

            {/* Selettore Soglia Prossimità Stop Loss */}
            <div className="rounded-lg border border-white/5 bg-black/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#E8C56A]">
                  Soglia Trigger di Tensione (Stop)
                </span>
                <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">
                  {slThreshold}% Distanza
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { pct: 15, label: "15% Stretta" },
                  { pct: 25, label: "25% AUREUS" },
                  { pct: 35, label: "35% Anticipata" },
                ].map((item) => (
                  <button
                    key={item.pct}
                    type="button"
                    onClick={() => handleSlThresholdChange(item.pct)}
                    disabled={!enabled}
                    className={`py-1.5 px-2 rounded text-[10px] font-mono font-bold tracking-tight uppercase transition-all duration-150 border cursor-pointer ${
                      slThreshold === item.pct
                        ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_8px_rgba(197,160,89,0.3)]"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9.5px] text-slate-500 block">
                Margine residuo prima dell&apos;accelerazione a 85-105 BPM
              </span>
            </div>
          </div>

          {/* Interruttore Vignette Ottica Perimetrale (Heat-Flash) */}
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-white/5 bg-black/40">
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-[#C5A059]/10 border border-[#C5A059]/25 text-[#E8C56A]">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-display text-xs uppercase font-bold tracking-wider text-[#F4F4F6] block">
                  Aura Ottica di Confine (Vignette Replay)
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Pulsazione perimetrale sincronizzata sui bordi del grafico nella Forgia
                </span>
              </div>
            </div>
            <Switch
              checked={vignetteEnabled}
              onCheckedChange={handleVignetteToggle}
              aria-label="Attiva o disattiva vignettatura visiva pulsante"
            />
          </div>

          {/* Test Acustico Immediato */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1">
              Collaudo Risuonatore:
            </span>
            <button
              type="button"
              onClick={() => handleToggleTestHeartbeat(60, 0.1)}
              disabled={!enabled || heartbeatMuted}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10.5px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                testHeartbeatBpm === 60
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse"
                  : "border-white/10 bg-white/5 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-slate-300 hover:text-[#E8C56A]"
              }`}
            >
              {testHeartbeatBpm === 60 ? <Square size={11} /> : <Play size={11} />}
              <span>Test Calma (60 BPM)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleTestHeartbeat(98, 0.85)}
              disabled={!enabled || heartbeatMuted}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10.5px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                testHeartbeatBpm === 98
                  ? "border-[#ef4444]/60 bg-[#ef4444]/20 text-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse"
                  : "border-white/10 bg-white/5 hover:border-[#ef4444]/40 hover:bg-[#ef4444]/10 text-slate-300 hover:text-[#ef4444]"
              }`}
            >
              {testHeartbeatBpm === 98 ? <Square size={11} /> : <Play size={11} />}
              <span>Test Allerta Stop (98 BPM)</span>
            </button>

            {testHeartbeatBpm !== null && (
              <button
                type="button"
                onClick={() => {
                  stopProceduralHeartbeat();
                  setTestHeartbeatBpm(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 text-slate-400 hover:text-white font-mono text-[10px] cursor-pointer ml-auto"
              >
                <Square size={10} />
                <span>Arresta</span>
              </button>
            )}
          </div>
        </div>

        {/* Profili Acustici d'Ordinamento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#C5A059]/80">
              Profili Acustici d&apos;Ordinamento
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 whitespace-nowrap">
              Tocca per provare la frequenza
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {soundProfiles.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.action()}
                  className={`flex flex-col justify-between p-3 rounded-lg border bg-[#11131c]/70 text-left transition-all duration-200 group ${p.accent}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded bg-black/40 border border-white/5 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold tracking-tight text-white group-hover:text-[#E8C56A] transition-colors truncate">
                        {p.title}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-slate-300 whitespace-nowrap shrink-0">
                      {p.chip}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug font-sans">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
