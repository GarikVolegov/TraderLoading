import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChroniclesHub } from "./chronicles/ChroniclesHub";
import { Maximize2, Minimize2, Shield } from "lucide-react";

interface DecompressionChamberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function DecompressionChamberModal({
  open,
  onOpenChange,
  activeTradeContext,
}: DecompressionChamberModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync with native HTML5 fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Exit fullscreen if modal is closed
  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open]);

  // Listen to custom fullscreen toggle events from embedded games
  useEffect(() => {
    const handleCustomToggle = () => {
      toggleFullscreen();
    };
    window.addEventListener("limen:toggle-fullscreen", handleCustomToggle);
    return () => window.removeEventListener("limen:toggle-fullscreen", handleCustomToggle);
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !isFullscreen) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Fallback to pure CSS viewport maximization
      setIsFullscreen((prev) => !prev);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`bg-[#07080b] border border-[#C5A059]/30 p-0 overflow-hidden text-foreground flex flex-col transition-all duration-300 ${
          isFullscreen
            ? "!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0 !p-0 !border-0 z-[150]"
            : "!w-[96vw] max-w-6xl !h-[90vh] max-h-[880px] rounded-2xl z-[100]"
        }`}
      >
        {/* Solemn Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d0f14] border-b border-[#C5A059]/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 flex items-center justify-center text-[#E8C56A]">
              <Shield size={15} />
            </div>
            <div>
              <DialogTitle className="text-sm font-mono font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Le Cronache del Distacco</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] uppercase font-bold tracking-wider">
                  Suite di Decompressione
                </span>
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-mono">
                La palestra della mente: sconfiggi La Deriva attraverso la maestria operativa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Riduci dimensione [ESC]" : "Schermo intero [F]"}
              className="p-1.5 rounded-lg border border-white/10 hover:border-[#C5A059]/40 text-muted-foreground hover:text-[#E8C56A] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        {/* Master Experience Hub Host */}
        <div className="flex-1 w-full h-full min-h-0 relative bg-black">
          <ChroniclesHub
            onClose={() => onOpenChange(false)}
            activeTradeContext={activeTradeContext}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
