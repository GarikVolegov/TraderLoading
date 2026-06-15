import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetProfile } from "@workspace/api-client-react";
import { X, Trophy, ExternalLink, Play, FileText, Presentation, Sparkles, ChevronRight } from "lucide-react";
import { getRewardsForMilestone, MILESTONES, type Reward, type RewardType } from "@/lib/rewardsLibrary";
import { useLanguage } from "@/contexts/LanguageContext";

function getCelebrated(): Set<number> {
  try {
    const raw = localStorage.getItem("tl_celebrated_milestones");
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch { return new Set(); }
}

function markCelebrated(milestone: number) {
  try {
    const s = getCelebrated();
    s.add(milestone);
    localStorage.setItem("tl_celebrated_milestones", JSON.stringify([...s]));
  } catch { /* ignore */ }
}

export function RewardTypeIcon({ type, className = "w-4 h-4" }: { type: RewardType; className?: string }) {
  if (type === "video")        return <Play className={className} />;
  if (type === "pdf")          return <FileText className={className} />;
  if (type === "presentazione") return <Presentation className={className} />;
  return null;
}

export function RewardTypeBadge({ type }: { type: RewardType }) {
  const map: Record<RewardType, { label: string; cls: string }> = {
    video:         { label: "Video",         cls: "text-red-400 bg-red-400/15 border-red-400/30" },
    pdf:           { label: "PDF",           cls: "text-blue-400 bg-blue-400/15 border-blue-400/30" },
    presentazione: { label: "Presentazione", cls: "text-violet-400 bg-violet-400/15 border-violet-400/30" },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>
      <RewardTypeIcon type={type} className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function RewardCard({ reward, compact = false }: { reward: Reward; compact?: boolean }) {
  return (
    <a
      href={reward.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl overflow-hidden border border-border/40 bg-card/60 hover:border-primary/40 hover:bg-card/80 transition-all ${compact ? "" : "hover:shadow-lg hover:shadow-primary/5"}`}
    >
      <div className="relative aspect-video overflow-hidden bg-secondary/30">
        <img
          src={reward.thumbnailUrl}
          alt={reward.title}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <RewardTypeBadge type={reward.type} />
          {reward.duration && (
            <span className="text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
              {reward.duration}
            </span>
          )}
        </div>
        <ExternalLink className="absolute top-2 right-2 w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {reward.title}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reward.description}</p>
        )}
        {reward.author && (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">{reward.author}</p>
        )}
      </div>
    </a>
  );
}

interface MilestoneModalProps {
  milestone: number;
  onClose: () => void;
}

function MilestoneModal({ milestone, onClose }: MilestoneModalProps) {
  const { t } = useLanguage();
  const rewards = getRewardsForMilestone(milestone);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 280 }}
        className="relative bg-card border border-primary/30 rounded-2xl shadow-2xl shadow-primary/10 w-full max-w-lg overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", damping: 12, stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/40 mb-4"
          >
            <Trophy className="w-10 h-10 text-primary" />
          </motion.div>

          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-primary/40 pointer-events-none"
              style={{ top: `${15 + Math.random() * 30}%`, left: `${10 + i * 15}%` }}
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: [-10, -30, -50], scale: [0.5, 1, 0.5] }}
              transition={{ delay: 0.2 + i * 0.1, duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
              {t("rewards.unlocked_badge")}
            </p>
            <h2 className="text-2xl font-bold">{t("rewards.milestone_title", { n: String(milestone) })}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("rewards.milestone_desc")}
            </p>
          </motion.div>
        </div>

        {rewards.length > 0 && (
          <div className="px-6 pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("rewards.unlocked_section")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {rewards.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.1 }}
                >
                  <RewardCard reward={r} compact />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 pt-4">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {t("rewards.go_library")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function LevelRewardModal() {
  const { data: profile } = useGetProfile();
  const [pendingMilestone, setPendingMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.level) return undefined;
    const level = profile.level;
    const celebrated = getCelebrated();

    const hit = MILESTONES.find((m) => level >= m && !celebrated.has(m));
    if (hit) {
      markCelebrated(hit);
      const timer = setTimeout(() => setPendingMilestone(hit), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [profile?.level]);

  return (
    <AnimatePresence>
      {pendingMilestone && (
        <MilestoneModal
          milestone={pendingMilestone}
          onClose={() => setPendingMilestone(null)}
        />
      )}
    </AnimatePresence>
  );
}
