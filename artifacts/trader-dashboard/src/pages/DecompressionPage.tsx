import { useState } from "react";
import { ChroniclesHub } from "@/components/decompression/chronicles/ChroniclesHub";
import { Shield, Trophy, Coins, Clock } from "lucide-react";
import { loadChroniclesPersistence } from "@/components/decompression/chronicles/chroniclesCampaignData";
import { useLocation } from "wouter";

export default function DecompressionPage() {
  const [, navigate] = useLocation();
  const [saveData] = useState(() => loadChroniclesPersistence());

  const formatDetachmentHours = (sec: number) => {
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} ore`;
  };

  return (
    <div className="flex-1 min-h-[calc(100dvh-4rem)] p-3 sm:p-6 max-w-7xl mx-auto flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0f14] border border-[#C5A059]/25 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(197,160,89,0.08)]">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/35 flex items-center justify-center text-[#E8C56A] shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
                LE CRONACHE DEL DISTACCO
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold uppercase tracking-wider">
                Oasi di Decompressione
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              La disciplina operativa si allena attraverso l'inazione conscia: sconfiggi La Deriva ed eleva il tuo Grado.
            </p>
          </div>
        </div>

        {/* Telemetry chips */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-2 text-xs font-mono">
            <Trophy size={13} className="text-[#E8C56A]" />
            <span className="text-muted-foreground">Capitoli:</span>
            <span className="font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
              {saveData.completedChapters.length}/5
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-2 text-xs font-mono">
            <Coins size={13} className="text-[#E8C56A]" />
            <span className="text-muted-foreground">Aurei:</span>
            <span className="font-bold text-foreground tabular-nums whitespace-nowrap">
              {saveData.totalAureiWallet}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-2 text-xs font-mono">
            <Clock size={13} className="text-emerald-400" />
            <span className="text-muted-foreground">Mani Ferme:</span>
            <span className="font-bold text-emerald-400 tabular-nums whitespace-nowrap">
              {formatDetachmentHours(saveData.totalDetachmentSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Master Hub Container */}
      <div className="flex-1 min-h-[620px] h-[72vh] w-full rounded-2xl overflow-hidden border border-[#C5A059]/25 bg-black">
        <ChroniclesHub onClose={() => navigate("/")} />
      </div>
    </div>
  );
}

