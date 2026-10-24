import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, RotateCcw, User, Heart, Calendar } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { useLanguage } from "@/contexts/LanguageContext";

export interface MediaLightboxItem {
  imageUrl: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content?: string;
  sphereLabel?: string;
  createdAt?: string;
  likesCount?: number;
}

export function MediaLightboxModal({
  item,
  onClose,
  onViewProfile,
}: {
  item: MediaLightboxItem | null;
  onClose: () => void;
  onViewProfile?: (userId: string) => void;
}) {
  const { language } = useLanguage();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [item?.imageUrl]);

  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col bg-black/92 backdrop-blur-md"
        onClick={onClose}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[#C5A059]/25 bg-[#0A0B10]/95 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (onViewProfile) {
                  onClose();
                  onViewProfile(item.userId);
                }
              }}
              className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity"
            >
              <Avatar name={item.userName} avatarUrl={item.avatarUrl} size="sm" ring="ring-[#C5A059]/50" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-white truncate">
                    {item.userName}
                  </span>
                  {item.sphereLabel && (
                    <span className="px-2 py-0.5 rounded-full border border-[#C5A059]/35 bg-[#C5A059]/10 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A]">
                      {item.sphereLabel}
                    </span>
                  )}
                </div>
                {item.createdAt && (
                  <p className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-[#C5A059]" />
                    {formatIntlRelativeTime(item.createdAt, language)}
                  </p>
                )}
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onViewProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewProfile(item.userId);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-[#C5A059]/20 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profilo Pubblico</span>
              </button>
            )}
            <div className="flex items-center rounded-lg border border-white/10 bg-[#12131A] p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                className="p-1.5 text-slate-300 hover:text-[#E8C56A] transition-colors"
                title="Riduci zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-[10px] text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                className="p-1.5 text-slate-300 hover:text-[#E8C56A] transition-colors"
                title="Aumenta zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Ripristina"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-[#C5A059]/30 bg-[#12131A] text-slate-300 hover:text-white hover:border-[#C5A059] transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image viewport */}
        <div
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 sm:p-8"
          onClick={onClose}
        >
          <img
            src={item.imageUrl}
            alt={item.content || item.userName}
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            className="max-h-full max-w-full object-contain rounded-xl border border-[#C5A059]/25 shadow-2xl transition-transform duration-150"
          />
        </div>

        {/* Footer caption */}
        {(item.content || typeof item.likesCount === "number") && (
          <div
            className="px-5 py-3.5 border-t border-[#C5A059]/20 bg-[#0A0B10]/95 flex items-center justify-between gap-4 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-4xl font-sans">
              {item.content}
            </p>
            {typeof item.likesCount === "number" && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-[#E8C56A] shrink-0">
                <Heart className="w-4 h-4 fill-[#E8C56A]/20 text-[#E8C56A]" />
                <span>{item.likesCount}</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
