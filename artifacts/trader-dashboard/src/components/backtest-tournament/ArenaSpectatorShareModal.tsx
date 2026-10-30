import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, Share2, Sparkles, Flame, Eye } from "lucide-react";
import { synestheticClick, synestheticCheck } from "@/lib/soundFx";

export interface ArenaSpectatorShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomCode?: string;
  combatantNames?: string[];
}

export function ArenaSpectatorShareModal({
  isOpen,
  onClose,
  roomId,
  roomCode,
  combatantNames = [],
}: ArenaSpectatorShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://aureus-os.app";

  const publicUrl = `${origin}/duello/${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    try {
      const qr = QRCode.create(publicUrl, { errorCorrectionLevel: "M" });
      const count = qr.modules.size;
      const canvas = canvasRef.current;
      const size = 160;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      // Sfondo Ossidiana profonda
      ctx.fillStyle = "#07080b";
      ctx.fillRect(0, 0, size, size);

      // Render moduli QR in Oro Aureo imperiale (#E8C56A)
      const cellSize = size / count;
      ctx.fillStyle = "#E8C56A";
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.modules.get(r, c)) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.35, cellSize + 0.35);
          }
        }
      }
    } catch (err) {
      console.warn("Arena QR code rendering notice:", err);
    }
  }, [isOpen, publicUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    synestheticCheck();
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const handleNativeShare = async () => {
    synestheticClick();
    if (!navigator.share) return;
    try {
      const duellantiStr = combatantNames.length > 0 ? ` [${combatantNames.join(" vs ")}]` : "";
      await navigator.share({
        title: "AUREUS PROTOCOL — Tribuna dei Duelli",
        text: `Assisti dal vivo alla Prova del Fuoco${duellantiStr} sul Protocollo AUREUS. Telemetria sincrona e curve di capitale live.`,
        url: publicUrl,
      });
    } catch {
      // Ignorato se l'utente annulla la condivisione nativa
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Condividi Tribuna d'Onore"
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-md rounded-2xl border border-[#C5A059]/40 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.22)] overflow-hidden my-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modale */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/25 bg-[#0d0f14] px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)]">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="font-serif text-sm sm:text-base font-bold tracking-wider text-white uppercase">
                Tribuna degli Spettatori
              </h3>
              <p className="font-mono text-[10.5px] text-muted-foreground">
                Invita la Fratellanza ad assistere alla Prova
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Chiudi Modale Condivisione"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo Modale */}
        <div className="p-5 flex flex-col items-center bg-[#07080b] space-y-4">
          {/* Badge Identificativo Arena */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C5A059]/35 bg-[#C5A059]/10 px-3 py-1 font-mono text-xs text-[#E8C56A]">
            <Flame size={12} className="text-[#C5A059]" />
            <span className="font-bold whitespace-nowrap">
              {roomCode ? `STANZA: ${roomCode}` : "ARENA LIVE"}
            </span>
            {combatantNames.length > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-white truncate max-w-[160px]">
                  {combatantNames.join(" vs ")}
                </span>
              </>
            )}
          </div>

          {/* QR Code Canvas */}
          <div className="p-3 rounded-xl border border-[#C5A059]/30 bg-[#0d0f14] shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
            <canvas ref={canvasRef} className="rounded block" />
            <span className="block text-center font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider mt-2 whitespace-nowrap">
              Scansiona per Accesso Immediato
            </span>
          </div>

          {/* Box URL & Copia Link */}
          <div className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#C5A059]/25 bg-[#0d0f14] px-3 py-2 text-xs font-mono">
            <span className="text-[#E8C56A] truncate text-[11px] select-all">
              {publicUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E8C56A] hover:text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-[#10b981]" />
                  <span className="text-[#10b981]">Copiato</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copia</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Azioni */}
        <div className="flex items-center justify-between gap-3 border-t border-[#C5A059]/20 bg-[#0d0f14] px-5 py-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <Sparkles size={12} className="text-[#C5A059]" />
            <span className="whitespace-nowrap">Sola Lettura Inviolabile</span>
          </div>

          <div className="flex items-center gap-2">
            {canShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059] bg-gradient-to-r from-[#C5A059] to-[#E8C56A] px-3.5 py-1.5 font-mono text-xs font-bold text-[#07080b] shadow-[0_0_12px_rgba(197,160,89,0.3)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
              >
                <Share2 size={13} />
                <span>Condividi</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg border border-white/10 bg-white/5 font-mono text-xs text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
