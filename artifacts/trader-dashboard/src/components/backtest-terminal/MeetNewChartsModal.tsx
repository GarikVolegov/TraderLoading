import { useEffect, useState } from "react";
import {
  BarChart3,
  Mic,
  PanelRightClose,
  List,
  PlaySquare,
  LayoutGrid,
  X,
  Play,
  Compass,
  Film,
  Sparkles,
} from "lucide-react";

export interface MeetNewChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTakeTour?: () => void;
  onSelectFeature?: (featureKey: "orderflow" | "journal" | "orderpanel" | "watchlist" | "controls" | "workspace") => void;
}

interface FeatureItem {
  key: "orderflow" | "journal" | "orderpanel" | "watchlist" | "controls" | "workspace";
  title: string;
  badge?: string;
  description: string;
  icon: typeof BarChart3;
}

const FEATURES: FeatureItem[] = [
  {
    key: "orderflow",
    title: "Order flow",
    badge: "NEW",
    description: "See order flow directly on the chart with volume profile, POC and delta footprint.",
    icon: BarChart3,
  },
  {
    key: "journal",
    title: "Talk to Journal",
    description: "Speak your notes while you trade. We'll turn it into an AI Session Note in your Journal, auto-linked to this session.",
    icon: Mic,
  },
  {
    key: "orderpanel",
    title: "Order panel",
    description: "On the right now. Pop it out or pin it to streamline execution speed.",
    icon: PanelRightClose,
  },
  {
    key: "watchlist",
    title: "Watchlist",
    description: "Every asset in one list. Flip between Forex, Metals, Indices and Crypto in a single click.",
    icon: List,
  },
  {
    key: "controls",
    title: "Price controls",
    description: "Drag it anywhere or pin it to the bottom with high-precision stepping and infinite replay.",
    icon: PlaySquare,
  },
  {
    key: "workspace",
    title: "Workspace",
    description: "Drag, resize, and arrange every panel your way with the Object Tree and Macro News.",
    icon: LayoutGrid,
  },
];

export function MeetNewChartsModal({
  isOpen,
  onClose,
  onTakeTour,
  onSelectFeature,
}: MeetNewChartsModalProps) {
  const [activeTourStep, setActiveTourStep] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveTourStep(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meet-charts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14] p-6 shadow-2xl shadow-black/90 font-sans text-slate-100 overflow-hidden">
        {/* Subtle imperial glow background decoration */}
        <div
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Chiudi introduzione"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mb-2 rounded-full border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#E8C56A]" />
            <span>AUREUS ARCHITECTURE · SOVEREIGN FORGE</span>
          </div>
          <h2
            id="meet-charts-title"
            className="text-2xl font-bold tracking-tight text-white mb-2"
          >
            Meet the new charts
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            We rebuilt charting from the ground up. Now nothing is holding us back. Faster loading,
            smoother indicators, infinite historical depth, and a workspace that's yours.
          </p>
        </div>

        {/* 6 Feature Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.key}
                onClick={() => {
                  if (onSelectFeature) {
                    onSelectFeature(feat.key);
                    onClose();
                  }
                }}
                className="group relative p-3.5 rounded-xl border border-white/10 bg-[#11131c]/90 hover:border-[#C5A059]/50 hover:bg-[#161924] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-black/60 border border-white/5 group-hover:border-[#C5A059]/30 text-slate-300 group-hover:text-[#E8C56A] transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    {feat.badge && (
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {feat.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#E8C56A] transition-colors mb-1">
                    {feat.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-3">
                    {feat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                if (onTakeTour) onTakeTour();
                else onClose();
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-blue-600/30 cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Take the 60-second tour</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              I'll explore
            </button>
          </div>

          <a
            href="https://www.youtube.com/watch?v=Z9-ik87kGzI"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-[#E8C56A] transition-colors underline-offset-4 hover:underline"
          >
            <Film className="w-3 h-3 text-[#C5A059]" />
            <span>Or watch the 8-minute video</span>
          </a>
        </div>
      </div>
    </div>
  );
}
