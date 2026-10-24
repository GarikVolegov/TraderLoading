import { useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  X,
  UserMinus,
  UserPlus,
  Lock,
  UserCheck,
  Heart,
  Sparkles,
  TrendingUp,
  Camera,
  Flame,
  Award,
  Layers,
} from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { Avatar } from "./Avatar";
import { useUserProfile } from "./hooks";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  parsePostMetadata,
  resolveOperatorGradeBadge,
  SphereBadge,
} from "./PostCard";
import type { SocialUser, Post } from "./types";

export function UserProfileModal({
  userId,
  currentUserId: _currentUserId,
  onClose,
  onStartChat,
}: {
  userId: string;
  currentUserId: string;
  onClose: () => void;
  onStartChat?: (u: SocialUser) => void;
}) {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useUserProfile(userId);
  const [activeTab, setActiveTab] = useState<"all" | "vita" | "analisi" | "media">("all");

  const follow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/follow-status", userId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
    },
  });
  const unfollow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/follow-status", userId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
    },
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const { titleId, panelProps } = useDialogA11y({
    isOpen: !isLoading,
    onClose,
    panelRef,
  });

  const {
    profile,
    posts = [],
    followersCount,
    followingCount,
    isFollowing,
    isMutual,
    isOwnProfile,
  } = data ?? {};

  const enrichedPosts = useMemo(() => {
    return (posts ?? []).map((p: Post) => ({
      post: p,
      meta: parsePostMetadata(p.content, Boolean(p.imageUrl)),
    }));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (activeTab === "vita") {
      return enrichedPosts.filter(
        (x) => x.meta.sphere === "vita" || x.meta.sphere === "tempio" || x.meta.sphere === "traguardo",
      );
    }
    if (activeTab === "analisi") {
      return enrichedPosts.filter((x) => x.meta.sphere === "analisi");
    }
    if (activeTab === "media") {
      return enrichedPosts.filter((x) => Boolean(x.post.imageUrl));
    }
    return enrichedPosts;
  }, [enrichedPosts, activeTab]);

  if (isLoading)
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#0C0D14] border border-[#C5A059]/30 rounded-2xl p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
        </div>
      </div>
    );

  const grade = resolveOperatorGradeBadge(profile?.level, profile?.xp);
  const streak = (profile as { streak?: number } | undefined)?.streak ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        {...panelProps}
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0A0B10] border border-[#C5A059]/35 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto text-slate-200 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sovereign Cover Banner */}
        <div className="relative h-28 bg-gradient-to-r from-[#17130A] via-[#0F111A] to-[#1A150B] border-b border-[#C5A059]/25 overflow-hidden">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,#C5A059,transparent_65%)]" />
          <div className="absolute top-3 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full border border-[#C5A059]/40 bg-black/60 font-mono text-[10px] font-bold uppercase tracking-widest text-[#E8C56A]">
              {grade.code} · {grade.title}
            </span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/35 bg-amber-500/10 font-mono text-[10px] font-bold text-amber-300">
                <Flame className="w-3 h-3 text-amber-400" />
                {streak}g Costanza
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={uiText("common.close")}
            className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 border border-white/10 hover:border-[#C5A059]/50 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 -mt-10 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div className="flex items-end gap-3.5">
              <div className="p-1 rounded-full bg-gradient-to-tr from-[#C5A059] via-[#E8C56A] to-[#8C6D2E] shadow-xl">
                <Avatar
                  name={profile?.name ?? "?"}
                  avatarUrl={profile?.avatarUrl}
                  size="lg"
                />
              </div>
              <div className="pb-0.5">
                <p
                  id={titleId}
                  className="font-display font-bold text-xl text-white"
                >
                  {profile?.name}
                </p>
                <p className="font-mono text-xs text-[#C5A059] flex items-center gap-1.5 mt-0.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Livello {profile?.level ?? 1} ·{" "}
                    {(profile?.xp ?? 0).toLocaleString()} XP
                  </span>
                </p>
              </div>
            </div>

            {!isOwnProfile && (
              <div className="flex items-center gap-2">
                {isFollowing ? (
                  <button
                    type="button"
                    onClick={() => unfollow.mutate()}
                    disabled={unfollow.isPending}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#C5A059]/30 bg-[#12131A] text-xs font-mono uppercase tracking-wider text-slate-200 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 transition-colors"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Smetti di seguire
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => follow.mutate()}
                    disabled={follow.isPending}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black text-xs font-mono font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Segui Profilo
                  </button>
                )}
                {isMutual && onStartChat && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartChat({
                        userId,
                        name: profile?.name ?? "Trader",
                        avatarUrl: profile?.avatarUrl ?? null,
                        isMutual: true,
                      });
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/40 text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#C5A059]/25 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" /> Messaggio
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Public Profile Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="rounded-xl border border-[#C5A059]/20 bg-[#11131C] p-3 text-center">
              <p className="font-mono text-base font-bold text-white">
                {followersCount ?? 0}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {uiText("auto.ui.995174eedf")}
              </p>
            </div>
            <div className="rounded-xl border border-[#C5A059]/20 bg-[#11131C] p-3 text-center">
              <p className="font-mono text-base font-bold text-white">
                {followingCount ?? 0}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {uiText("auto.ui.90eeb10083")}
              </p>
            </div>
            <div className="rounded-xl border border-[#C5A059]/20 bg-[#11131C] p-3 text-center">
              <p className="font-mono text-base font-bold text-[#E8C56A]">
                {posts?.length ?? 0}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {uiText("auto.ui.7858ac3ff6")}
              </p>
            </div>
          </div>

          {isMutual && !isOwnProfile && (
            <div className="flex items-center gap-1.5 text-xs text-[#E8C56A] mb-4 bg-[#C5A059]/10 border border-[#C5A059]/25 rounded-xl px-3.5 py-2 font-mono">
              <UserCheck className="w-3.5 h-3.5 text-[#C5A059]" /> Confratelli connessi · Messaggistica diretta attiva
            </div>
          )}

          {/* Profile Showcase Tabs: Vita vs Analisi vs Media */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#07080C] border border-white/10 mb-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Tutto ({enrichedPosts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("vita")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "vita"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Vita &amp; Stile</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("analisi")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "analisi"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Analisi</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "media"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Galleria Foto</span>
            </button>
          </div>

          {/* Public Posts Content */}
          {filteredPosts.length > 0 ? (
            activeTab === "media" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredPosts.map(({ post: p, meta }) => (
                  <div
                    key={p.id}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-[#C5A059]/25 bg-[#06070A]"
                  >
                    <img
                      src={p.imageUrl!}
                      alt={meta.cleanContent || p.userName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                      <SphereBadge sphere={meta.sphere} />
                      {meta.cleanContent && (
                        <p className="text-[11px] text-white line-clamp-2 mt-1">
                          {meta.cleanContent}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map(({ post: p, meta }) => (
                  <div
                    key={p.id}
                    className="bg-[#11131C] border border-[#C5A059]/20 rounded-xl p-3.5 text-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SphereBadge sphere={meta.sphere} />
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatIntlRelativeTime(p.createdAt, language)}
                      </span>
                    </div>
                    {meta.cleanContent && (
                      <p className="text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {meta.cleanContent}
                      </p>
                    )}
                    {p.imageUrl && (
                      <div className="rounded-lg overflow-hidden border border-[#C5A059]/20 bg-[#06070A]">
                        <img
                          src={p.imageUrl}
                          alt={meta.cleanContent || p.userName}
                          className="w-full max-h-72 object-contain"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono pt-1 border-t border-white/5">
                      <span className="flex items-center gap-1 text-[#E8C56A]">
                        <Heart className="w-3.5 h-3.5" />
                        {p.likesCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-[#C5A059]/25 bg-[#10121A]/60 p-6 text-center space-y-1">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                Nessun contenuto in questa sezione
              </p>
              <p className="text-xs text-slate-500">
                Il trader non ha ancora pubblicato elementi in questa categoria del profilo pubblico.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
