import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  UserMinus,
  Lock,
  Sparkles,
  TrendingUp,
  Camera,
  Layers,
  Award,
  Flame,
  Maximize2,
  Users,
  Heart,
  Loader2,
} from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { Avatar } from "./Avatar";
import { useUserProfile, useLeaderboard, useMutualFollowers } from "./hooks";
import {
  parsePostMetadata,
  resolveOperatorGradeBadge,
  SphereBadge,
} from "./PostCard";
import type { SocialUser, Post } from "./types";
import type { MediaLightboxItem } from "./MediaLightboxModal";

export function PublicProfilesShowcaseFlank({
  currentUserId,
  inspectedUserId,
  onSelectTrader,
  onOpenFullProfile,
  onStartChat,
  onOpenLightbox,
}: {
  currentUserId: string;
  inspectedUserId: string | null;
  onSelectTrader: (userId: string) => void;
  onOpenFullProfile: (userId: string) => void;
  onStartChat: (u: SocialUser) => void;
  onOpenLightbox: (item: MediaLightboxItem) => void;
}) {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const { data: leaderboard = [] } = useLeaderboard();
  const { data: mutuals = [] } = useMutualFollowers();

  // Directory of public profiles combining leaderboard and mutuals
  const publicTraders = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        name: string;
        avatarUrl: string | null;
        level: number;
        xp: number;
        isMutual?: boolean;
      }
    >();

    for (const m of mutuals) {
      if (m.userId) {
        map.set(m.userId, {
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          level: m.level ?? 1,
          xp: m.xp ?? 0,
          isMutual: true,
        });
      }
    }

    for (const entry of leaderboard) {
      if (entry.userId) {
        const prev = map.get(entry.userId);
        map.set(entry.userId, {
          userId: entry.userId,
          name: entry.name,
          avatarUrl: entry.avatarUrl ?? prev?.avatarUrl ?? null,
          level: entry.level ?? prev?.level ?? 1,
          xp: entry.xp ?? prev?.xp ?? 0,
          isMutual: prev?.isMutual,
        });
      }
    }

    return Array.from(map.values());
  }, [leaderboard, mutuals]);

  const effectiveTargetId = useMemo(() => {
    if (inspectedUserId) return inspectedUserId;
    const otherTrader = publicTraders.find((t) => t.userId !== currentUserId);
    return otherTrader?.userId ?? currentUserId;
  }, [inspectedUserId, publicTraders, currentUserId]);

  const { data: profileData, isLoading: profileLoading } = useUserProfile(
    effectiveTargetId || null,
  );

  const [showcaseTab, setShowcaseTab] = useState<"all" | "vita" | "analisi" | "foto">("all");

  const follow = useMutation({
    mutationFn: (uid: string) => apiJSON(`social/follow/${uid}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/profile", effectiveTargetId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
    },
  });

  const unfollow = useMutation({
    mutationFn: (uid: string) => apiJSON(`social/follow/${uid}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/profile", effectiveTargetId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
    },
  });

  const profile = profileData?.profile;
  const posts: Post[] = profileData?.posts ?? [];
  const followersCount = profileData?.followersCount ?? 0;
  const followingCount = profileData?.followingCount ?? 0;
  const isFollowing = profileData?.isFollowing ?? false;
  const isMutual = profileData?.isMutual ?? false;
  const isOwnProfile = profileData?.isOwnProfile ?? effectiveTargetId === currentUserId;

  const grade = resolveOperatorGradeBadge(profile?.level, profile?.xp);
  const streak = (profile as { streak?: number } | undefined)?.streak ?? 0;

  const enrichedPosts = useMemo(() => {
    return posts.map((p) => ({
      post: p,
      meta: parsePostMetadata(p.content, Boolean(p.imageUrl)),
    }));
  }, [posts]);

  const filteredShowcasePosts = useMemo(() => {
    if (showcaseTab === "vita") {
      return enrichedPosts.filter(
        (x) =>
          x.meta.sphere === "vita" ||
          x.meta.sphere === "tempio" ||
          x.meta.sphere === "traguardo",
      );
    }
    if (showcaseTab === "analisi") {
      return enrichedPosts.filter((x) => x.meta.sphere === "analisi");
    }
    if (showcaseTab === "foto") {
      return enrichedPosts.filter((x) => Boolean(x.post.imageUrl));
    }
    return enrichedPosts;
  }, [enrichedPosts, showcaseTab]);

  return (
    <aside className="flex flex-col gap-3.5 w-full">
      {/* 1. PROFILO PUBBLICO IN PRIMO PIANO (LIVE TRADER SHOWCASE) */}
      <div className="rounded-2xl border border-[#C5A059]/35 bg-gradient-to-b from-[#0E1018] to-[#090A0F] overflow-hidden shadow-lg">
        {/* Header Bar */}
        <div className="px-3.5 py-2.5 border-b border-[#C5A059]/20 bg-[#0C0E15] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] shrink-0" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#E8C56A] truncate">
              Vetrina Profilo Pubblico
            </span>
          </div>
          {effectiveTargetId && (
            <button
              type="button"
              onClick={() => onOpenFullProfile(effectiveTargetId)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] font-mono text-[9px] uppercase tracking-wider hover:bg-[#C5A059]/20 transition-colors shrink-0"
            >
              <Maximize2 className="w-2.5 h-2.5" />
              <span>Scheda Intera</span>
            </button>
          )}
        </div>

        {profileLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
          </div>
        ) : profile ? (
          <div className="p-3.5 space-y-3">
            {/* Trader Identity */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => effectiveTargetId && onOpenFullProfile(effectiveTargetId)}
                className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059] via-[#E8C56A] to-[#8C6D2E] shrink-0 hover:scale-105 transition-transform"
              >
                <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="md" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => effectiveTargetId && onOpenFullProfile(effectiveTargetId)}
                    className="font-display text-sm font-bold text-white hover:text-[#E8C56A] transition-colors truncate"
                  >
                    {profile.name}
                  </button>
                  {isOwnProfile && (
                    <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 font-mono text-[8px] uppercase text-[#E8C56A]">
                      Tu
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-[#C5A059] flex items-center gap-1 mt-0.5">
                  <Award className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {grade.code} · {grade.title}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-slate-400">
                  <span>Lv.{profile.level ?? 1}</span>
                  <span>·</span>
                  <span>{(profile.xp ?? 0).toLocaleString()} XP</span>
                  {streak > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-300 inline-flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 text-amber-400" />
                        {streak}g
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Public Stats */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-xl border border-white/8 bg-[#12141E] py-1.5 px-2 text-center">
                <p className="font-mono text-xs font-bold text-white">
                  {followersCount}
                </p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
                  Follower
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-[#12141E] py-1.5 px-2 text-center">
                <p className="font-mono text-xs font-bold text-white">
                  {followingCount}
                </p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
                  Seguiti
                </p>
              </div>
              <div className="rounded-xl border border-[#C5A059]/25 bg-[#C5A059]/10 py-1.5 px-2 text-center">
                <p className="font-mono text-xs font-bold text-[#E8C56A]">
                  {posts.length}
                </p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-[#E8C56A]/80">
                  Post
                </p>
              </div>
            </div>

            {/* Follow / Message CTAs */}
            {!isOwnProfile && effectiveTargetId && (
              <div className="flex gap-2">
                {isFollowing ? (
                  <button
                    type="button"
                    onClick={() => unfollow.mutate(effectiveTargetId)}
                    disabled={unfollow.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-white/15 bg-[#12131A] font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:text-destructive hover:border-destructive/40 transition-colors"
                  >
                    <UserMinus className="w-3 h-3" />
                    <span>Seguito</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => follow.mutate(effectiveTargetId)}
                    disabled={follow.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Segui Trader</span>
                  </button>
                )}
                {isMutual && (
                  <button
                    type="button"
                    onClick={() =>
                      onStartChat({
                        userId: effectiveTargetId,
                        name: profile.name,
                        avatarUrl: profile.avatarUrl,
                        isMutual: true,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-[#C5A059]/25 transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Chat</span>
                  </button>
                )}
              </div>
            )}

            {/* Trader's Public Wall Tabs: Vita & Analisi */}
            <div className="pt-1 border-t border-white/8 space-y-2.5">
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#07080C] border border-white/8">
                <button
                  type="button"
                  onClick={() => setShowcaseTab("all")}
                  className={`py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    showcaseTab === "all"
                      ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>Tutto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseTab("vita")}
                  className={`py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    showcaseTab === "vita"
                      ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Vita</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseTab("analisi")}
                  className={`py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    showcaseTab === "analisi"
                      ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>Analisi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseTab("foto")}
                  className={`py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    showcaseTab === "foto"
                      ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Camera className="w-2.5 h-2.5" />
                  <span>Foto</span>
                </button>
              </div>

              {filteredShowcasePosts.length > 0 ? (
                showcaseTab === "foto" ? (
                  <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {filteredShowcasePosts.slice(0, 6).map(({ post: p, meta }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          onOpenLightbox({
                            imageUrl: p.imageUrl!,
                            userId: p.userId,
                            userName: p.userName,
                            avatarUrl: p.avatarUrl,
                            content: meta.cleanContent,
                            sphereLabel: meta.sphereLabel,
                            createdAt: p.createdAt,
                            likesCount: p.likesCount,
                          })
                        }
                        className="aspect-square rounded-lg overflow-hidden border border-[#C5A059]/25 bg-[#06070A] group relative"
                      >
                        <img
                          src={p.imageUrl!}
                          alt={meta.cleanContent || p.userName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                    {filteredShowcasePosts.slice(0, 4).map(({ post: p, meta }) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-white/8 bg-[#12141E] p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <SphereBadge sphere={meta.sphere} />
                          <span className="font-mono text-[9px] text-slate-500">
                            {formatIntlRelativeTime(p.createdAt, language)}
                          </span>
                        </div>
                        {meta.cleanContent && (
                          <p className="text-xs text-slate-200 line-clamp-2 font-sans">
                            {meta.cleanContent}
                          </p>
                        )}
                        {p.imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLightbox({
                                imageUrl: p.imageUrl!,
                                userId: p.userId,
                                userName: p.userName,
                                avatarUrl: p.avatarUrl,
                                content: meta.cleanContent,
                                sphereLabel: meta.sphereLabel,
                                createdAt: p.createdAt,
                                likesCount: p.likesCount,
                              })
                            }
                            className="w-full rounded-lg overflow-hidden border border-[#C5A059]/20 bg-[#06070A]"
                          >
                            <img
                              src={p.imageUrl}
                              alt="Post media"
                              className="w-full h-24 object-cover"
                            />
                          </button>
                        )}
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span className="inline-flex items-center gap-1 text-[#E8C56A]">
                            <Heart className="w-2.5 h-2.5" />
                            {p.likesCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#11131C]/50 p-4 text-center">
                  <p className="font-mono text-[10px] text-slate-400">
                    Nessun contenuto in questa sfera del profilo.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. DIRECTORY PROFILI PUBBLICI DELL'ORDINE (SCOPRI TRADER) */}
      <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0A0B10] p-3.5 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#C5A059]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#F4F4F6]">
              Profili Pubblici dei Trader
            </span>
          </div>
          <span className="font-mono text-[9px] text-[#C5A059]">
            {publicTraders.length} Attivi
          </span>
        </div>

        <p className="text-[11px] text-slate-400 px-1 leading-snug">
          Seleziona un trader per esplorare la sua vita, i suoi traguardi e le sue analisi pubbliche.
        </p>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
          {publicTraders.slice(0, 12).map((trader) => {
            const tGrade = resolveOperatorGradeBadge(trader.level, trader.xp);
            const isSelected = effectiveTargetId === trader.userId;
            return (
              <div
                key={trader.userId}
                className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all ${
                  isSelected
                    ? "border-[#C5A059]/60 bg-[#C5A059]/12 shadow-sm"
                    : "border-white/6 bg-[#11131C]/70 hover:border-[#C5A059]/30 hover:bg-[#141722]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTrader(trader.userId)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059]/80 to-[#E8C56A]/60 shrink-0">
                    <Avatar
                      name={trader.name}
                      avatarUrl={trader.avatarUrl}
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-display text-xs font-bold text-white truncate">
                        {trader.name}
                      </p>
                      {trader.isMutual && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[8px] text-emerald-300 uppercase">
                          Mutual
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[9px] text-[#C5A059]/90 truncate">
                      {tGrade.code} · Lv.{trader.level} ·{" "}
                      {trader.xp.toLocaleString()} XP
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenFullProfile(trader.userId)}
                  className="px-2 py-1 rounded-lg border border-[#C5A059]/30 bg-[#0A0B10] text-[#E8C56A] hover:bg-[#C5A059]/20 font-mono text-[9px] uppercase tracking-wider shrink-0 transition-colors"
                >
                  Profilo
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
