import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, Download, X, Award, ShieldCheck, Check, Sparkles, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type HonorCardData,
  generateHonorCardDataUrl,
  shareHonorCard,
  copyHonorCardToClipboard,
  downloadHonorCardPng,
  computeHonorHash,
} from "@/lib/honorCardGenerator";
import { synestheticClick, synestheticTrophy, synestheticCheck } from "@/lib/soundFx";

export interface HonorCardShareModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly data: HonorCardData | null;
}

export function HonorCardShareModal({ isOpen, onClose, data }: HonorCardShareModalProps) {
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const firedTrophy = useRef(false);

  // Genera l'anteprima Retina all'apertura del modale
  useEffect(() => {
    if (!isOpen || !data) {
      setPreviewUrl(null);
      setIsGenerating(true);
      firedTrophy.current = false;
      return;
    }

    if (!firedTrophy.current) {
      firedTrophy.current = true;
      synestheticTrophy();
    }

    setIsGenerating(true);
    const timer = setTimeout(() => {
      try {
        const url = generateHonorCardDataUrl(data);
        setPreviewUrl(url);
      } catch (err) {
        console.error("Errore generazione Scheda d'Onore:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, data]);

  // Registrazione non-bloccante del sigillo sul registro pubblico API
  useEffect(() => {
    if (!isOpen || !data) return;
    void fetch("/api/public/register-honor-seal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {
      // Ignora errori di background
    });
  }, [isOpen, data]);

  // Gestione tasto Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleShare = useCallback(async () => {
    if (!data || isSharing) return;
    synestheticClick();
    setIsSharing(true);
    try {
      const res = await shareHonorCard(data);
      if (res.method === "clipboard") {
        setCopied(true);
        synestheticCheck();
        toast.success(t("honor_card.copied"));
        setTimeout(() => setCopied(false), 2400);
      }
    } catch (err) {
      console.error("Errore durante la condivisione:", err);
    } finally {
      setIsSharing(false);
    }
  }, [data, isSharing, t]);

  const handleCopy = useCallback(async () => {
    if (!data || copied) return;
    synestheticClick();
    const ok = await copyHonorCardToClipboard(data);
    if (ok) {
      setCopied(true);
      synestheticCheck();
      toast.success(t("honor_card.copied") || "Scheda d'onore copiata negli appunti");
      setTimeout(() => setCopied(false), 2400);
    } else {
      // Fallback su download
      await downloadHonorCardPng(data);
    }
  }, [data, copied, t]);

  const handleDownload = useCallback(async () => {
    if (!data) return;
    synestheticClick();
    await downloadHonorCardPng(data);
  }, [data]);

  const handleCopyLink = useCallback(() => {
    if (!data) return;
    synestheticClick();
    const hash = data.verificationHash || computeHonorHash(data);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const verifyUrl = `${origin}/api/public/verify-honor/${encodeURIComponent(hash)}`;
    navigator.clipboard
      .writeText(verifyUrl)
      .then(() => {
        synestheticCheck();
        toast.success("Link di verifica copiato per l'anteprima social");
      })
      .catch(() => {
        toast.error("Impossibile copiare il link");
      });
  }, [data]);

  if (!isOpen || !data) return null;

  const hash = data.verificationHash || computeHonorHash(data);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t("honor_card.title")}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="bg-[#0b0d14] border border-[#C5A059]/40 rounded-2xl shadow-[0_0_50px_rgba(197,160,89,0.18)] max-w-3xl w-full overflow-hidden flex flex-col relative"
        >
          {/* Header Solenne */}
          <div className="px-5 py-4 border-b border-[#C5A059]/20 flex items-center justify-between bg-[#0e1019]/90">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.2)]">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold font-serif tracking-wider text-[#F4F4F6] flex items-center gap-2">
                  <span>{t("honor_card.title")}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#E8C56A]">
                    {"RETINA 2X"}
                  </span>
                </h2>
                <p className="text-xs text-[#8E8E98] tracking-tight">{t("honor_card.subtitle")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                synestheticClick();
                onClose();
              }}
              aria-label={t("honor_card.close")}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1A1A22] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body: Canvas Preview 1200x630 Aspect Ratio */}
          <div className="p-4 sm:p-6 flex flex-col items-center gap-4">
            <div className="w-full aspect-[1200/630] rounded-xl overflow-hidden border border-[#C5A059]/30 bg-[#07080b] shadow-2xl relative flex items-center justify-center">
              {isGenerating || !previewUrl ? (
                <div className="flex flex-col items-center gap-3 text-[#C5A059]">
                  <Sparkles className="w-7 h-7 animate-spin text-[#E8C56A]" />
                  <span className="text-xs font-mono tracking-widest uppercase text-[#94a3b8]">
                    {t("honor_card.generating")}
                  </span>
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt={data.title || t("honor_card.title")}
                  className="w-full h-full object-contain select-none"
                />
              )}
            </div>

            {/* Micro-telemetria di verifica */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-mono text-[#71717a]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-semibold">{t("honor_card.verified")}</span>
              </div>
              <div className="flex items-center gap-2 text-[#8E8E98]">
                <span>{"HASH: "}</span>
                <span className="text-[#E8C56A] font-semibold">{hash}</span>
                <a
                  href={`/api/public/verify-honor/${encodeURIComponent(hash)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[9.5px] text-[#C5A059] hover:underline flex items-center gap-0.5 ml-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Verifica API</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  title="Copia link per anteprima social (X, Telegram, Discord)"
                  className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#C5A059]/10 hover:bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#E8C56A] transition-colors flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Link2 className="w-2.5 h-2.5" />
                  <span>Copia Link</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-4 border-t border-[#C5A059]/20 bg-[#0a0c12] flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                synestheticClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#141620] transition-colors border border-transparent"
            >
              {t("honor_card.close")}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono text-[#E8C56A] bg-[#141620] border border-[#C5A059]/35 hover:bg-[#C5A059]/15 transition-all shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t("honor_card.copied") : t("honor_card.copy_image")}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono text-[#F4F4F6] bg-[#1a1c28] border border-[#C5A059]/40 hover:bg-[#222536] transition-all shadow-sm"
            >
              <Download className="w-4 h-4 text-[#C5A059]" />
              <span>{t("honor_card.download")}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold text-[#07080b] bg-gradient-to-r from-[#C5A059] via-[#E8C56A] to-[#C5A059] hover:from-[#E8C56A] hover:to-[#F3D88C] transition-all shadow-[0_0_18px_rgba(197,160,89,0.3)] hover:shadow-[0_0_24px_rgba(197,160,89,0.45)]"
            >
              <Share2 className="w-4 h-4" />
              <span>{t("honor_card.share_native")}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
