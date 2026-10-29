import { useState } from "react";
import {
  Watch,
  Heart,
  Bluetooth,
  Radio,
  CheckCircle2,
  Settings2,
  Activity,
  Battery,
} from "lucide-react";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { SmartWatchConnectModal } from "@/components/biometrics/SmartWatchConnectModal";

export function SmartWatchSettingsSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const {
    bpm,
    zone,
    deviceName,
    batteryLevel,
    isLive,
    isBleConnected,
    isSimulated,
    isWebBluetoothSupported,
  } = useSmartWatchHeartRate();

  const zoneColor =
    zone === "zen"
      ? "#10b981"
      : zone === "vigilant"
      ? "#C5A059"
      : "#ef4444";

  return (
    <>
      <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
              <Watch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
                  Sentinella Biometrica & Smartwatch
                </h3>
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                  GATT 0x180D
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground/80">
                Monitoraggio battito live e rilevazione fisiologica dello stress decisionale.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-xs font-mono font-bold text-[#E8C56A] transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configura Dispositivo</span>
          </button>
        </div>

        {/* Body Status Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card Stato Connessione */}
          <div className="rounded-xl border border-white/10 bg-[#07080b] p-3.5 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Stato Connessione
            </span>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isLive ? zoneColor : "#71717a" }}
              />
              <span className="text-xs font-mono font-bold text-foreground truncate">
                {isBleConnected
                  ? deviceName || "Smartwatch BLE"
                  : isSimulated
                  ? "Simulazione Attiva"
                  : "Nessun Sensore Collegato"}
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              {isBleConnected
                ? "Streaming wireless Web Bluetooth a bassa latenza"
                : isSimulated
                ? "Emulazione ritmo cardiaco e variabilità HRV"
                : "Pronto per l'accoppiamento Bluetooth"}
            </p>
          </div>

          {/* Card Battito Live */}
          <div className="rounded-xl border border-white/10 bg-[#07080b] p-3.5 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Frequenza Cardiaca Live
            </span>
            <div className="flex items-baseline gap-2">
              <Heart
                className="w-4 h-4 shrink-0"
                style={{
                  color: isLive ? zoneColor : "#71717a",
                  fill: isLive ? zoneColor : "none",
                  animation: isLive
                    ? `pulse ${(60 / bpm).toFixed(2)}s ease-in-out infinite`
                    : "none",
                }}
              />
              <span
                className="text-xl font-mono font-bold tracking-tight"
                style={{ color: isLive ? zoneColor : "#71717a" }}
              >
                {isLive ? bpm : "--"}
              </span>
              <span className="text-xs font-mono text-muted-foreground uppercase font-bold">
                BPM
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              {isLive
                ? zone === "zen"
                  ? "Zona Smeraldo (Assetto Calmo)"
                  : zone === "vigilant"
                  ? "Zona Oro (Vigilanza Elevata)"
                  : "Zona Rubino (Allerta Cardio)"
                : "Avvia o connetti un orologio"}
            </p>
          </div>

          {/* Card Batteria & Compatibilità */}
          <div className="rounded-xl border border-white/10 bg-[#07080b] p-3.5 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Dispositivo & Telemetria
            </span>
            <div className="flex items-center gap-2">
              {batteryLevel !== undefined ? (
                <>
                  <Battery className="w-4 h-4 text-[#10b981]" />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {batteryLevel}% Batteria
                  </span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 text-[#C5A059]" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {isWebBluetoothSupported ? "Web BLE Supportato" : "Web BLE Non Disponibile"}
                  </span>
                </>
              )}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              Compatibile con Apple Watch, Garmin, Polar, Whoop e fasce Bluetooth.
            </p>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/5 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Zero latenza di rete: elaborazione 100% lato client sul dispositivo locale.</span>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-[#E8C56A] hover:underline flex items-center gap-1"
          >
            <Activity className="w-3.5 h-3.5 text-[#C5A059]" />
            Apri Telemetria ECG
          </button>
        </div>
      </div>

      <SmartWatchConnectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
