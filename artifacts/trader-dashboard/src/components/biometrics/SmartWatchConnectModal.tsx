import React, { useState, useEffect } from "react";
import {
  Heart,
  Watch,
  Bluetooth,
  Battery,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Radio,
  RefreshCw,
  X,
  Volume2,
  VolumeX,
  Wind,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useSmartWatchHeartRate } from "../../hooks/useSmartWatchHeartRate";
import {
  startProceduralHeartbeat,
  setHeartbeatBpm,
  stopProceduralHeartbeat,
  isHeartbeatActive,
  synestheticClick,
} from "../../lib/soundFx";
import { TacticalBreathModal } from "../cockpit/TacticalBreathModal";

interface SmartWatchConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export function SmartWatchConnectModal({ open, onClose }: SmartWatchConnectModalProps) {
  const {
    bpm,
    status,
    zone,
    deviceName,
    batteryLevel,
    sensorContact,
    hrvRmssd,
    isLive,
    isBleConnected,
    isSimulated,
    isWebBluetoothSupported,
    error,
    connectBleWatch,
    disconnectWatch,
    startSimulation,
    stopSimulation,
    setSimulationTargetBpm,
  } = useSmartWatchHeartRate();

  const [activeTab, setActiveTab] = useState<"apple" | "garmin" | "polar">("apple");
  const [breathModalOpen, setBreathModalOpen] = useState(false);
  const [audioHeartbeatActive, setAudioHeartbeatActive] = useState(() => isHeartbeatActive());

  // Sincronizza il battito procedurale con il BPM reale
  useEffect(() => {
    if (audioHeartbeatActive && isLive) {
      setHeartbeatBpm(bpm);
    }
  }, [bpm, audioHeartbeatActive, isLive]);

  const handleToggleAudio = () => {
    synestheticClick();
    if (audioHeartbeatActive) {
      stopProceduralHeartbeat();
      setAudioHeartbeatActive(false);
    } else {
      startProceduralHeartbeat(bpm);
      setAudioHeartbeatActive(true);
    }
  };

  if (!open) return null;

  const zoneColor =
    zone === "zen"
      ? "#10b981"
      : zone === "vigilant"
      ? "#C5A059"
      : "#ef4444";

  const zoneTitle =
    zone === "zen"
      ? "Assetto Zen (Lucidità Sovrana)"
      : zone === "vigilant"
      ? "Assetto Vigile (Tensione Operativa)"
      : "Rischio Deriva (Tachicardia Emotiva)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14] text-foreground shadow-2xl shadow-black/80 flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smartwatch-modal-title"
      >
        {/* ── HEADER SOVRANO ── */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/20 px-5 py-4 bg-gradient-to-r from-[#0d0f14] via-[#141822] to-[#0d0f14]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.2)]">
              <Watch className="w-5 h-5 text-[#C5A059]" />
              {isLive && (
                <span
                  className="absolute -top-1 -right-1 flex h-3 w-3"
                  title="Sensore attivo"
                >
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: zoneColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-3 w-3"
                    style={{ backgroundColor: zoneColor }}
                  />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="smartwatch-modal-title"
                  className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-[#F4F4F6]"
                >
                  Sentinella Biometrica Smartwatch
                </h2>
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                  GATT 0x180D
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground">
                Acquisizione live battito cardiaco e stress cardio-disciplinare.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#C5A059]/10 hover:text-[#E8C56A] transition-colors"
            aria-label="Chiudi telemetria smartwatch"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── CORPO PRINCIPALE SCROLLABILE ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {/* Card Telemetria Live & ECG Waveform */}
          <div className="rounded-xl border border-white/10 bg-[#07080b] p-4 relative overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Heart
                  className="w-5 h-5 shrink-0 transition-transform"
                  style={{
                    color: zoneColor,
                    fill: zoneColor,
                    animation: isLive
                      ? `pulse ${(60 / bpm).toFixed(2)}s ease-in-out infinite`
                      : "none",
                  }}
                />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-mono text-3xl font-black tracking-tight"
                      style={{ color: zoneColor }}
                    >
                      {bpm}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground uppercase font-bold whitespace-nowrap">
                      BPM
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    {zoneTitle}
                  </div>
                </div>
              </div>

              {/* Informazioni Dispositivo & Sensore */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                {batteryLevel !== undefined && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 text-muted-foreground">
                    <Battery className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="whitespace-nowrap font-bold text-foreground">
                      {batteryLevel}%
                    </span>
                  </div>
                )}
                {hrvRmssd !== undefined && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 text-muted-foreground"
                    title="Root Mean Square of Successive Differences (HRV / Variabilità Cardiaca)"
                  >
                    <span className="text-[10px] text-muted-foreground">HRV:</span>
                    <span className="whitespace-nowrap font-bold text-[#E8C56A]">
                      {hrvRmssd} ms
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono font-semibold whitespace-nowrap ${
                    isBleConnected
                      ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981]"
                      : isSimulated
                      ? "border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A]"
                      : "border-white/10 bg-white/5 text-muted-foreground"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>
                    {isBleConnected
                      ? deviceName || "Smartwatch Connesso"
                      : isSimulated
                      ? "Simulazione Attiva"
                      : "Disconnesso"}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulatore Vettoriale ECG / Onda di Polso Arterioso */}
            <div className="mt-3 relative h-16 w-full rounded-lg bg-black/50 border border-white/5 flex items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 400 60"
                className="w-full h-full preserve-3d"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={zoneColor} stopOpacity="0.1" />
                    <stop offset="70%" stopColor={zoneColor} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={zoneColor} stopOpacity="1" />
                  </linearGradient>
                </defs>
                {/* Griglia millimetrata di fondo */}
                <line x1="0" y1="30" x2="400" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
                {/* Tracciato ECG Vettoriale P-Q-R-S-T */}
                <path
                  d={
                    isLive
                      ? "M 0 30 L 80 30 L 95 28 L 105 32 L 115 30 L 125 30 L 132 35 L 140 5 L 148 48 L 155 30 L 175 30 L 185 24 L 200 30 L 280 30 L 295 28 L 305 32 L 315 30 L 325 30 L 332 35 L 340 5 L 348 48 L 355 30 L 375 30 L 385 24 L 400 30"
                      : "M 0 30 L 400 30"
                  }
                  fill="none"
                  stroke="url(#ecgGrad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isLive ? "animate-pulse" : ""}
                />
              </svg>

              {!isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                  <span className="text-[11px] font-mono text-muted-foreground/80">
                    In attesa di connessione dallo Smartwatch o avvio simulatore
                  </span>
                </div>
              )}
            </div>

            {/* Micro-controlli ausiliari Audio & Respiro */}
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
                  audioHeartbeatActive
                    ? "border-[#ef4444]/50 bg-[#ef4444]/15 text-[#ef4444]"
                    : "border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {audioHeartbeatActive ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>
                  {audioHeartbeatActive ? "Risuonatore Attivo" : "Audio Silenziato"}
                </span>
              </button>

              {zone === "ruby_drift" && (
                <button
                  type="button"
                  onClick={() => setBreathModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#ef4444]/50 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] animate-pulse"
                >
                  <Wind className="w-3.5 h-3.5" />
                  <span className="font-bold">Avvia Respiro Tattico 4-7-8</span>
                </button>
              )}
            </div>
          </div>

          {/* Errore eventuale */}
          {error && (
            <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/15 p-3 flex items-start gap-2.5 text-xs font-mono text-[#ef4444]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Attenzione Telemetria</p>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {/* ── SEZIONE AZIONI DI CONNESSIONE ── */}
          <div className="rounded-xl border border-[#C5A059]/25 bg-[#11131c] p-4 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5">
              <Bluetooth className="w-4 h-4 text-[#C5A059]" />
              Gestione Connessione Wireless
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Connessione Reale BLE */}
              <button
                type="button"
                onClick={connectBleWatch}
                disabled={status === "scanning" || status === "connecting"}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#C5A059]/60 bg-gradient-to-r from-[#C5A059]/20 to-[#E8C56A]/10 hover:from-[#C5A059]/30 hover:to-[#E8C56A]/20 text-[#E8C56A] font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(197,160,89,0.15)] disabled:opacity-50"
              >
                {status === "scanning" || status === "connecting" ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C5A059]" />
                    <span>Ricerca Smartwatch...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 text-[#C5A059]" />
                    <span>Collega Smartwatch (BLE)</span>
                  </>
                )}
              </button>

              {/* Demo / Simulatore */}
              {isSimulated ? (
                <button
                  type="button"
                  onClick={stopSimulation}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-xs font-semibold transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Arresta Simulazione</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSimulation(72)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-[#F4F4F6] font-mono text-xs font-semibold transition-colors"
                >
                  <Radio className="w-4 h-4 text-[#C5A059]" />
                  <span>Avvia Simulazione (Demo)</span>
                </button>
              )}
            </div>

            {/* Se è connesso uno smartwatch reale */}
            {isBleConnected && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={disconnectWatch}
                  className="text-xs font-mono text-[#ef4444] hover:underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Disconnetti {deviceName}
                </button>
              </div>
            )}

            {/* Controlli manuali per la modalità simulata */}
            {isSimulated && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Test Soglie Fisiologiche:</span>
                  <span className="text-[#C5A059] font-bold">Target {bpm} BPM</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimulationTargetBpm(66)}
                    className="px-2 py-1.5 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] font-mono text-[11px] font-bold text-center"
                  >
                    Zen (66 BPM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationTargetBpm(82)}
                    className="px-2 py-1.5 rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[11px] font-bold text-center"
                  >
                    Vigile (82 BPM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationTargetBpm(104)}
                    className="px-2 py-1.5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-mono text-[11px] font-bold text-center"
                  >
                    Deriva (104 BPM)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── GUIDA RAPIDA PROTOCOLLO PAIRING ── */}
          <div className="rounded-xl border border-white/10 bg-[#07080b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#C5A059]" />
                Istruzioni di Trasmissione per Dispositivo
              </h4>
              <div className="flex rounded-lg border border-white/10 p-0.5 bg-black/40 text-[10px] font-mono">
                {(["apple", "garmin", "polar"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-2 py-0.5 rounded font-bold uppercase transition-colors ${
                      activeTab === tab
                        ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "apple" ? "Apple Watch" : tab === "garmin" ? "Garmin" : "Polar / Whoop"}
                  </button>
                ))}
              </div>
            </div>

            {/* Contenuto Guida Dinamico */}
            <div className="text-xs font-mono text-muted-foreground/90 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 space-y-1.5">
              {activeTab === "apple" && (
                <>
                  <p className="font-bold text-[#F4F4F6] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    Apple Watch (watchOS):
                  </p>
                  <p>
                    1. Scarica un'app di trasmissione BLE gratuita su Apple Watch (es. <span className="text-[#E8C56A] font-bold">HeartCast</span>, <span className="text-[#E8C56A] font-bold">BlueHeart</span> o <span className="text-[#E8C56A] font-bold">ECHO</span>).
                  </p>
                  <p>
                    2. Apri l'app sull'Apple Watch e avvia la trasmissione ("Start Broadcasting").
                  </p>
                  <p>
                    3. Clicca su <span className="text-[#E8C56A] font-bold">"Collega Smartwatch (BLE)"</span> in alto e seleziona il dispositivo.
                  </p>
                </>
              )}

              {activeTab === "garmin" && (
                <>
                  <p className="font-bold text-[#F4F4F6] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    Garmin (Fenix, Forerunner, Venu, Epix, Instinct):
                  </p>
                  <p>
                    1. Sull'orologio vai su: <span className="text-[#E8C56A] font-bold">Menu → Sensori & Accessori → Frequenza Cardiaca al Polso</span>.
                  </p>
                  <p>
                    2. Attiva l'opzione <span className="text-[#E8C56A] font-bold">"Trasmetti FC" (Broadcast Heart Rate)</span>.
                  </p>
                  <p>
                    3. Clicca su <span className="text-[#E8C56A] font-bold">"Collega Smartwatch (BLE)"</span> in questa schermata per accoppiare il segnale.
                  </p>
                </>
              )}

              {activeTab === "polar" && (
                <>
                  <p className="font-bold text-[#F4F4F6] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    Polar H10, Verity Sense, Whoop 4.0, Fasce Toraciche:
                  </p>
                  <p>
                    1. Indossa la fascia o il bracciale cardio assicurando il contatto con la pelle.
                  </p>
                  <p>
                    2. Per Whoop: attiva <span className="text-[#E8C56A] font-bold">"Broadcast Heart Rate"</span> nelle impostazioni dell'app Whoop.
                  </p>
                  <p>
                    3. Il sensore Bluetooth standard GATT sarà rilevato istantaneamente cliccando su "Collega Smartwatch (BLE)".
                  </p>
                </>
              )}
            </div>

            {!isWebBluetoothSupported && (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[11px] font-mono text-[#E8C56A]">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Web Bluetooth è attivo su Google Chrome, Microsoft Edge, Opera e WebBLE iOS. Se usi Safari o Firefox, puoi sfruttare la simulazione ad alta precisione.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER MODALE ── */}
        <div className="flex items-center justify-between border-t border-[#C5A059]/20 px-5 py-3.5 bg-[#07080b]">
          <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColor }} />
            <span>Stato: {isLive ? `${bpm} BPM (${zoneTitle})` : "Nessun flusso"}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-xs font-mono font-bold text-[#E8C56A] transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Modale Respiro Tattico 4-7-8 se attivata */}
      <TacticalBreathModal
        isOpen={breathModalOpen}
        onClose={() => setBreathModalOpen(false)}
      />
    </div>
  );
}
