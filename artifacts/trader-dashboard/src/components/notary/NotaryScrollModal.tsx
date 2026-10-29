import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  FileCheck2,
  Shield,
  Sparkles,
  Share2,
  Film,
} from "lucide-react";
import {
  renderNotaryScroll,
  downloadNotaryScroll,
  printNotaryScroll,
  computeNotaryHash,
  downloadNotaryCinematicVideo,
  isCinematicVideoSupported,
  type NotaryScrollData,
} from "@/lib/notaryScrollGenerator";
import {
  synestheticClick,
  synestheticCheck,
  synestheticTrophy,
} from "@/lib/soundFx";

export interface NotaryScrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: NotaryScrollData;
}

export function NotaryScrollModal({
  isOpen,
  onClose,
  data,
}: NotaryScrollModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [videoSupported, setVideoSupported] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const hash = data.verificationHash || computeNotaryHash(data);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
    setVideoSupported(isCinematicVideoSupported());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    synestheticTrophy();

    // Rilascio del canvas dopo montaggio
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        renderNotaryScroll(canvasRef.current, { ...data, verificationHash: hash });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, data, hash]);

  if (!isOpen) return null;

  const handleCopyHash = async () => {
    synestheticCheck();
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handlePrint = () => {
    synestheticClick();
    printNotaryScroll({ ...data, verificationHash: hash });
  };

  const handleDownload = () => {
    synestheticClick();
    downloadNotaryScroll(
      { ...data, verificationHash: hash },
      `AUREUS-Attestazione-Notarile-${data.operatorName}.png`
    );
  };

  const handleGenerateCinema = async () => {
    if (isGeneratingVideo) return;
    synestheticClick();
    setIsGeneratingVideo(true);
    setVideoProgress(0);
    try {
      await downloadNotaryCinematicVideo(
        { ...data, verificationHash: hash },
        `AUREUS-Cinema-Notarile-${data.operatorName}.webm`,
        (pct) => setVideoProgress(pct)
      );
      synestheticTrophy();
    } catch (err) {
      console.warn("handleGenerateCinema error:", err);
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(0);
    }
  };

  const handleShare = async () => {
    synestheticClick();
    if (!canvasRef.current || !navigator.share) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `AUREUS-Pergamena-${data.operatorName}.png`, {
          type: "image/png",
        });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "AUREUS PROTOCOL — Attestazione Notarile",
            text: `Attestazione Notarile di Integrità per ${data.operatorName} · Impronta SHA-256: ${hash}`,
            files: [file],
          });
        } else {
          await navigator.share({
            title: "AUREUS PROTOCOL — Attestazione Notarile",
            text: `Attestazione Notarile di Integrità per ${data.operatorName} · Impronta SHA-256: ${hash}`,
            url: `${window.location.origin}/verifica/${hash}`,
          });
        }
      }, "image/png");
    } catch {
      // Condivisione annullata dall'utente
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pergamena Notarile Sovrana AUREUS"
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[92vh] w-full max-w-4xl rounded-2xl border border-[#C5A059]/40 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.22)] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modale */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/25 bg-[#0d0f14] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)]">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base sm:text-lg font-bold tracking-wider text-[#FFFFFF] uppercase">
                  Pergamena Notarile Sovrana
                </h2>
                <span className="rounded bg-[#C5A059]/15 border border-[#C5A059]/35 px-2 py-0.5 font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider">
                  SHA-256 A4
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                Attestazione immutabile di disciplina e conformità al Protocollo AUREUS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer"
            aria-label="Chiudi Pergamena"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo Modale con Preview Scrollabile ad Alta Risoluzione */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-[#050608]/90">
          <div className="relative max-w-[560px] w-full rounded-xl border border-[#C5A059]/30 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden bg-[#07080b]">
            <canvas
              ref={canvasRef}
              className="w-full h-auto block"
              style={{ aspectRatio: "1240 / 1754" }}
            />
          </div>

          {/* Barrotto con Impronta SHA-256 */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 w-full max-w-[560px] rounded-lg border border-[#C5A059]/25 bg-[#0d0f14] px-3 py-2 text-[11px] font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <Shield size={14} className="shrink-0 text-[#C5A059]" />
              <span className="text-muted-foreground whitespace-nowrap">Impronta SHA-256:</span>
              <span className="text-[#E8C56A] font-bold truncate">
                {hash.slice(0, 18)}...{hash.slice(-8)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyHash}
              className="flex items-center gap-1 text-[10.5px] font-bold text-[#E8C56A] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} />}
              <span>{copied ? "Copiato" : "Copia"}</span>
            </button>
          </div>
        </div>

        {/* Footer Azioni Rapide */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C5A059]/20 bg-[#0d0f14] px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Sparkles size={14} className="text-[#C5A059]" />
            <span className="whitespace-nowrap">Risoluzione di stampa: 300 DPI A4</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {videoSupported && (
              <button
                type="button"
                onClick={handleGenerateCinema}
                disabled={isGeneratingVideo}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 px-3.5 py-2 font-mono text-xs font-bold text-[#E8C56A] hover:bg-[#C5A059]/25 hover:border-[#C5A059]/60 disabled:opacity-60 transition-all cursor-pointer whitespace-nowrap"
                title="Genera ed esporta video cinematico (WebM) con sigillo animato e rintocco a 432 Hz"
              >
                {isGeneratingVideo ? (
                  <>
                    <Sparkles size={14} className="animate-spin text-[#E8C56A]" />
                    <span className="whitespace-nowrap">Forgiatura Cinema {videoProgress}%</span>
                  </>
                ) : (
                  <>
                    <Film size={14} />
                    <span className="whitespace-nowrap">Cinema d'Onore (WebM)</span>
                  </>
                )}
              </button>
            )}

            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 px-3.5 py-2 font-mono text-xs font-bold text-[#E8C56A] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 transition-all cursor-pointer whitespace-nowrap"
              >
                <Share2 size={14} />
                <span>Condividi</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 px-3.5 py-2 font-mono text-xs font-bold text-[#E8C56A] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download size={14} />
              <span>Scarica Immagine HD</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059] bg-gradient-to-r from-[#C5A059] to-[#E8C56A] px-4 py-2 font-mono text-xs font-bold text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.3)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer size={14} />
              <span>Stampa / Salva PDF A4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
