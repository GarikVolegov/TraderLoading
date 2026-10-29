import { useState, useMemo } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGetFriendsQueryKey,
  getGetPendingFriendRequestsQueryKey,
  getSearchUsersQueryKey,
  useGetPendingFriendRequests,
  useRespondToFriendRequest,
  useSendFriendRequest,
} from "@workspace/api-client-react";
import {
  Loader2,
  Plus,
  X,
  Search,
  UserPlus,
  UserMinus,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Trophy,
  Camera,
  LayoutList,
  LayoutGrid,
  Users,
  Award,
  Globe,
} from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { Avatar } from "./Avatar";
import {
  useFeed,
  useStories,
  useSocialSearch,
  useFriendSearch,
  useLeaderboard,
  useUserProfile,
} from "./hooks";
import type { StoryGroup, SocialUser, FriendSearchResult } from "./types";
import { UserProfileModal } from "./UserProfileModal";
import { StoryViewer } from "./StoryViewer";
import { CreatePostModal } from "./CreatePostModal";
import {
  PostCard,
  parsePostMetadata,
  resolveOperatorGradeBadge,
  type PostSphere,
} from "./PostCard";
import {
  PublicProfileLeftFlank,
  type ChroniclesFilterId,
} from "./PublicProfileLeftFlank";
import { PublicProfilesShowcaseFlank } from "./PublicProfilesShowcaseFlank";
import {
  MediaLightboxModal,
  type MediaLightboxItem,
} from "./MediaLightboxModal";

export function SocialTab({
  currentUserId,
  onStartChat,
}: {
  currentUserId: string;
  onStartChat: (u: SocialUser) => void;
}) {
  const {
    data: feedData,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();
  const feed = useMemo(
    () => feedData?.pages.flatMap((page) => page.items) ?? [],
    [feedData],
  );
  const { data: storyGroups = [] } = useStories();
  const { data: leaderboard = [] } = useLeaderboard();

  const [viewingStories, setViewingStories] = useState<{
    groups: StoryGroup[];
    index: number;
  } | null>(null);
  const [createConfig, setCreateConfig] = useState<{
    open: boolean;
    sphere: PostSphere;
    isStory: boolean;
  }>({ open: false, sphere: "vita", isStory: false });

  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<MediaLightboxItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChroniclesFilterId>("all");
  const [viewMode, setViewMode] = useState<"stream" | "grid">("stream");

  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { data: searchResults = [] } = useSocialSearch(searchQ);
  const { data: friendSearchResults = [] } = useFriendSearch(searchQ);
  const { data: pendingFriendRequests = [] } = useGetPendingFriendRequests();

  // Also fetch inspected trader's public posts so if the user clicks a trader in the directory
  // or if their personal feed has few items, they can see public profile posts!
  const { data: inspectedProfileData } = useUserProfile(inspectedUserId);

  const qc = useQueryClient();
  const friendStatusByUserId = useMemo(() => {
    return new Map(
      (friendSearchResults as FriendSearchResult[])
        .filter((result) => result.userId)
        .map((result) => [result.userId!, result.relationshipStatus ?? "none"]),
    );
  }, [friendSearchResults]);

  const refreshFriendQueries = () => {
    qc.invalidateQueries({ queryKey: getSearchUsersQueryKey({ q: searchQ }) });
    qc.invalidateQueries({ queryKey: getGetPendingFriendRequestsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
    qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
  };

  const sendFriendRequestMutation = useSendFriendRequest({
    mutation: {
      onSuccess: refreshFriendQueries,
      onError: refreshFriendQueries,
    },
  });

  const respondToFriendRequestMutation = useRespondToFriendRequest({
    mutation: {
      onSuccess: refreshFriendQueries,
    },
  });

  const follow = useMutation({
    mutationFn: (uid: string) =>
      apiJSON(`social/follow/${uid}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/search", searchQ] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/profile"] });
    },
  });
  const unfollow = useMutation({
    mutationFn: (uid: string) =>
      apiJSON(`social/follow/${uid}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/search", searchQ] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/profile"] });
    },
  });

  // Combine feed with inspected public profile posts (deduplicated by id)
  const combinedPosts = useMemo(() => {
    const map = new Map<
      number,
      (typeof feed)[number]
    >();
    for (const item of feed) {
      map.set(item.id, item);
    }
    if (inspectedProfileData?.posts) {
      for (const p of inspectedProfileData.posts) {
        if (!map.has(p.id)) {
          map.set(p.id, {
            ...p,
            likedByMe: Boolean(p.likedByMe),
            isOwnPost: p.userId === currentUserId,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.id - a.id);
  }, [feed, inspectedProfileData?.posts, currentUserId]);

  const annotatedPosts = useMemo(() => {
    return combinedPosts.map((post) => ({
      post,
      meta: parsePostMetadata(post.content, Boolean(post.imageUrl)),
    }));
  }, [combinedPosts]);

  const filterCounts = useMemo<Record<ChroniclesFilterId, number>>(() => {
    const counts: Record<ChroniclesFilterId, number> = {
      all: annotatedPosts.length,
      vita: 0,
      tempio: 0,
      analisi: 0,
      traguardo: 0,
      media: 0,
      miei: 0,
    };
    for (const { post, meta } of annotatedPosts) {
      if (meta.sphere === "vita") counts.vita += 1;
      if (meta.sphere === "tempio") counts.tempio += 1;
      if (meta.sphere === "analisi") counts.analisi += 1;
      if (meta.sphere === "traguardo") counts.traguardo += 1;
      if (post.imageUrl) counts.media += 1;
      if (post.userId === currentUserId) counts.miei += 1;
    }
    return counts;
  }, [annotatedPosts, currentUserId]);

  const filteredPosts = useMemo(() => {
    switch (activeFilter) {
      case "vita":
        return annotatedPosts.filter((x) => x.meta.sphere === "vita");
      case "tempio":
        return annotatedPosts.filter((x) => x.meta.sphere === "tempio");
      case "analisi":
        return annotatedPosts.filter((x) => x.meta.sphere === "analisi");
      case "traguardo":
        return annotatedPosts.filter((x) => x.meta.sphere === "traguardo");
      case "media":
        return annotatedPosts.filter((x) => Boolean(x.post.imageUrl));
      case "miei":
        return annotatedPosts.filter((x) => x.post.userId === currentUserId);
      default:
        return annotatedPosts;
    }
  }, [annotatedPosts, activeFilter, currentUserId]);

  const openComposer = (sphere: PostSphere = "vita", isStory = false) => {
    setCreateConfig({ open: true, sphere, isStory });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#07080B] text-slate-200">
      {/* TOP HEADER BAR */}
      <div className="px-4 py-3 border-b border-[#C5A059]/20 bg-[#0A0B10] flex items-center justify-between gap-3 shrink-0">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C5A059]/45 bg-[#C5A059]/12 text-[#E8C56A] shrink-0 shadow-[0_0_15px_rgba(197,160,89,0.15)]">
            <SigilIcon name="fratellanza" size={15} />
          </div>
          {showSearch ? (
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C5A059]/70" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                aria-label={uiText("auto.ui.d174e7aa6b")}
                placeholder="Cerca Profili Pubblici dei Trader dell'Ordine..."
                autoFocus
                className="w-full pl-9 pr-4 py-1.5 bg-[#12131A] border border-[#C5A059]/35 rounded-xl text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-[#F4F4F6] truncate">
                  Le Cronache dell&apos;Ordine
                </p>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#C5A059]/35 bg-[#C5A059]/10 font-mono text-[9px] uppercase tracking-widest text-[#E8C56A]">
                  Profili Pubblici · Vita &amp; Analisi
                </span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 hidden sm:block truncate">
                Esplora i profili pubblici dei trader: il loro stile di vita, la disciplina quotidiana e la loro visione di mercato
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Stream vs Grid Bacheca Switch */}
          <div className="hidden sm:flex items-center rounded-xl border border-[#C5A059]/25 bg-[#12131A] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("stream")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all ${
                viewMode === "stream"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Vista Flusso"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Flusso</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all ${
                viewMode === "grid"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Vista Bacheca 2 Colonne"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Bacheca</span>
            </button>
          </div>

          <button
            type="button"
            aria-label={uiText(showSearch ? "common.close" : "auto.ui.d174e7aa6b")}
            aria-expanded={showSearch}
            onClick={() => {
              setShowSearch((s) => !s);
              setSearchQ("");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#12131A] text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059] transition-all"
          >
            {showSearch ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            aria-label={uiText("chat.new_post")}
            onClick={() => openComposer("vita", false)}
            className="flex h-8 px-3.5 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pubblica nel Profilo</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {showSearch && searchQ.length >= 2 ? (
          <div className="p-4 max-w-4xl mx-auto space-y-2.5">
            <p className="font-mono text-xs uppercase tracking-widest text-[#C5A059] mb-2">
              Risultati Profili Pubblici ({searchResults.length})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map(
                (u) =>
                  u.userId && (
                    <div
                      key={u.userId}
                      className="flex items-center gap-3 p-3.5 bg-[#0C0E15] rounded-2xl border border-[#C5A059]/25 hover:border-[#C5A059]/50 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setViewingProfile(u.userId!)}
                      >
                        <Avatar
                          name={u.name}
                          avatarUrl={u.avatarUrl}
                          size="sm"
                        />
                      </button>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setViewingProfile(u.userId!)}
                      >
                        <p className="text-sm font-bold text-white truncate">
                          {u.name}
                        </p>
                        <p className="text-xs font-mono text-[#C5A059] whitespace-nowrap truncate">
                          {resolveOperatorGradeBadge(u.level, u.xp).code} · {resolveOperatorGradeBadge(u.level, u.xp).title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {u.isMutual && (
                          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                            Mutual
                          </span>
                        )}
                        {(() => {
                          const relationshipStatus =
                            friendStatusByUserId.get(u.userId!) ?? "none";
                          if (relationshipStatus === "accepted") {
                            return (
                              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1">
                                {uiText("auto.ui.7d6318448b")}
                              </span>
                            );
                          }
                          if (relationshipStatus === "pending_sent") {
                            return (
                              <span className="text-[10px] bg-secondary/60 text-muted-foreground border border-border rounded-full px-2 py-1">
                                {uiText("auto.ui.f4fbb496bb")}
                              </span>
                            );
                          }
                          if (relationshipStatus === "pending_received") {
                            return (
                              <button
                                type="button"
                                onClick={() => setShowSearch(false)}
                                className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                              >
                                {uiText("auto.ui.7298262b60")}
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                sendFriendRequestMutation.mutate({
                                  data: { friendUserId: u.userId! },
                                })
                              }
                              disabled={sendFriendRequestMutation.isPending}
                              className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                            >
                              {uiText("auto.ui.7fd20b6519")}
                            </button>
                          );
                        })()}
                        {u.isFollowing ? (
                          <button
                            type="button"
                            onClick={() => unfollow.mutate(u.userId!)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => follow.mutate(u.userId!)}
                            className="p-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ),
              )}
            </div>
            {searchResults.length === 0 && searchQ.length >= 2 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                {uiText("auto.ui.f4b60ba9f9")}
              </p>
            )}
          </div>
        ) : (
          /* 3-COLUMN PUBLIC PROFILES & LIFE+ANALYSIS HUB */
          <div className="p-3 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-[285px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_330px] gap-4 lg:gap-5 items-start max-w-[1800px] mx-auto w-full">
            {/* LEFT FLANK: My Public Profile & Spheres Navigation */}
            <div className="hidden lg:block sticky top-0">
              <PublicProfileLeftFlank
                currentUserId={currentUserId}
                activeFilter={activeFilter}
                onSelectFilter={setActiveFilter}
                filterCounts={filterCounts}
                onOpenCreate={(sphere) => openComposer(sphere ?? "vita", false)}
                onInspectProfile={(uid) => setInspectedUserId(uid)}
                onViewProfileModal={(uid) => setViewingProfile(uid)}
                onOpenLightbox={setLightboxItem}
                pendingFriendRequests={pendingFriendRequests}
                onRespondFriendRequest={(id, action) =>
                  respondToFriendRequestMutation.mutate({
                    id,
                    data: { action },
                  })
                }
                isRespondingFriendRequest={
                  respondToFriendRequestMutation.isPending
                }
              />
            </div>

            {/* CENTER COLUMN: Stories, Multimodal Composer, Feed & Public Profiles Showcase */}
            <div className="min-w-0 space-y-4">
              {/* Mobile/Tablet Pending Requests (shown when left flank is hidden) */}
              {pendingFriendRequests.length > 0 && (
                <div className="lg:hidden p-3.5 rounded-2xl border border-[#C5A059]/30 bg-[#0A0B10]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#E8C56A] mb-2.5">
                    {uiText("auto.ui.4555767847")}
                  </p>
                  <div className="space-y-2">
                    {pendingFriendRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 p-2.5 bg-[#12131A] rounded-xl border border-border"
                      >
                        <Avatar
                          name={request.senderName ?? "Trader"}
                          avatarUrl={request.senderAvatar}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {request.senderName ?? "Trader"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {uiText("auto.ui.a51a25e19b")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            respondToFriendRequestMutation.mutate({
                              id: request.id,
                              data: { action: "accept" },
                            })
                          }
                          disabled={respondToFriendRequestMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                        >
                          {uiText("auto.ui.ab8585e7c5")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            respondToFriendRequestMutation.mutate({
                              id: request.id,
                              data: { action: "reject" },
                            })
                          }
                          disabled={respondToFriendRequestMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-medium disabled:opacity-50 transition-colors"
                        >
                          {uiText("auto.ui.68b880f2a6")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. STORIE & MOMENTI 24h (SATURATED SHOWCASE STRIP) */}
              <div className="rounded-2xl border border-[#C5A059]/25 bg-gradient-to-r from-[#0B0D14] via-[#0E1019] to-[#0B0D14] p-3.5 shadow-md">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E8C56A]" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#E8C56A]">
                      Momenti &amp; Storie 24h dei Trader
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openComposer("vita", true)}
                    className="font-mono text-[10px] text-[#C5A059] hover:text-[#E8C56A] uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Aggiungi Storia</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {/* Add Story Card */}
                  <button
                    type="button"
                    onClick={() => openComposer("vita", true)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-[#C5A059]/45 bg-[#12141E]/80 hover:bg-[#C5A059]/15 hover:border-[#C5A059] transition-all shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#E8C56A] shrink-0">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                        Nuovo Momento
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Vita o Sessione (24h)
                      </p>
                    </div>
                  </button>

                  {/* Active Stories */}
                  {storyGroups.map((group, i) => (
                    <button
                      type="button"
                      key={group.userId}
                      aria-label={uiText("social.story.alt", {
                        name: group.userName,
                      })}
                      onClick={() =>
                        setViewingStories({ groups: storyGroups, index: i })
                      }
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#C5A059]/30 bg-[#12141E] hover:border-[#C5A059] transition-all shrink-0 group"
                    >
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059] via-[#E8C56A] to-[#997A35] shadow-[0_0_12px_rgba(197,160,89,0.28)] group-hover:scale-105 transition-transform">
                        <Avatar
                          name={group.userName}
                          avatarUrl={group.avatarUrl}
                          size="sm"
                        />
                      </div>
                      <div className="text-left">
                        <p className="font-display text-xs font-bold text-white truncate max-w-[100px]">
                          {group.isOwn ? "La tua Storia" : group.userName}
                        </p>
                        <p className="font-mono text-[9px] text-[#E8C56A] uppercase">
                          {group.stories.length}{" "}
                          {group.stories.length === 1 ? "momento" : "momenti"}
                        </p>
                      </div>
                    </button>
                  ))}

                  {/* Quick Story Inspiration Prompts to saturate horizontal strip */}
                  <button
                    type="button"
                    onClick={() => openComposer("vita", false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-[#10121B]/70 hover:border-[#C5A059]/40 text-left transition-all shrink-0"
                  >
                    <Sparkles className="w-4 h-4 text-[#E8C56A] shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-slate-200 uppercase">
                        Mostra la tua Giornata
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Postazione, luoghi, lifestyle
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openComposer("tempio", false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-[#10121B]/70 hover:border-emerald-500/40 text-left transition-all shrink-0"
                  >
                    <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-slate-200 uppercase">
                        Tempio Fisico
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Allenamento &amp; disciplina
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. BANCO DI PUBBLICAZIONE RAPIDA (VITA + ANALISI COMPOSER) */}
              <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0B0D14] p-3.5 sm:p-4 space-y-3 shadow-md">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openComposer("vita", false)}
                    className="flex-1 text-left px-4 py-2.5 rounded-xl bg-[#12141E] border border-[#C5A059]/25 hover:border-[#C5A059]/60 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-all"
                  >
                    Condividi un momento della tua vita, la tua postazione o una tua analisi sul tuo profilo pubblico...
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer("vita", false)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all shrink-0"
                  >
                    Pubblica
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openComposer("vita", false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-[#C5A059]/25 bg-[#12141E]/80 hover:bg-[#C5A059]/15 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Vita &amp; Stile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer("tempio", false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-emerald-500/25 bg-[#12141E]/80 hover:bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Dumbbell className="w-3.5 h-3.5" />
                    <span>Tempio Fisico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer("analisi", false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-sky-500/25 bg-[#12141E]/80 hover:bg-sky-500/15 text-sky-300 font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Analisi &amp; Grafici</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer("traguardo", false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-amber-500/25 bg-[#12141E]/80 hover:bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Traguardo</span>
                  </button>
                </div>
              </div>

              {/* Mobile / Tablet Filter Pills (visible when left flank is hidden) */}
              <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(
                  [
                    { id: "all", label: "Tutto", Icon: Globe },
                    { id: "vita", label: "Vita & Stile", Icon: Sparkles },
                    { id: "tempio", label: "Tempio Fisico", Icon: Dumbbell },
                    { id: "analisi", label: "Analisi", Icon: TrendingUp },
                    { id: "traguardo", label: "Traguardi", Icon: Trophy },
                    { id: "media", label: "Foto", Icon: Camera },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.Icon;
                  const active = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase tracking-wider border shrink-0 transition-all ${
                        active
                          ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] font-bold"
                          : "border-white/10 bg-[#0C0E15] text-slate-400"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 3. FEED POSTS (STREAM OR 2-COLUMN BACHECA GRID) */}
              {feedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0A0B10] p-6 text-center space-y-3">
                  <div className="mx-auto h-11 w-11 rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 flex items-center justify-center text-[#E8C56A]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-base font-bold text-white">
                      Inaugura questa Sfera delle Cronache
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Condividi uno scatto della tua giornata, il tuo ambiente operativo o una tua analisi per arricchire il tuo profilo pubblico.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {activeFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setActiveFilter("all")}
                        className="px-4 py-2 rounded-xl border border-[#C5A059]/30 bg-[#12131A] text-xs font-mono uppercase tracking-wider text-slate-300 hover:text-white"
                      >
                        Mostra Tutto
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openComposer("vita", false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono text-xs font-bold uppercase tracking-wider rounded-xl hover:brightness-110"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pubblica Ora</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={
                      viewMode === "grid" || activeFilter === "media"
                        ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                        : "space-y-4"
                    }
                  >
                    {filteredPosts.map(({ post }) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUserId={currentUserId}
                        onViewProfile={setViewingProfile}
                        onInspectProfile={(uid) => setInspectedUserId(uid)}
                        onOpenLightbox={setLightboxItem}
                        compact={viewMode === "grid" || activeFilter === "media"}
                      />
                    ))}
                  </div>

                  {hasNextPage && (
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="mx-auto mt-2 block rounded-xl border border-[#C5A059]/30 bg-[#0C0E15] px-5 py-2 font-mono text-xs uppercase tracking-wider text-[#E8C56A] transition-colors hover:border-[#C5A059] disabled:opacity-50"
                    >
                      {uiText("chat.feed.load_more")}
                    </button>
                  )}
                </>
              )}

              {/* 4. VETRINE PUBBLICHE DEI TRADER DELL'ORDINE (INLINE SHOWCASE GRID) */}
              {leaderboard.length > 0 && (
                <div className="rounded-2xl border border-[#C5A059]/25 bg-gradient-to-b from-[#0C0E15] to-[#090A0F] p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C5A059]" />
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                          Vetrine Pubbliche dei Trader dell&apos;Ordine
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Esplora i profili dei confratelli, segui il loro percorso di vita e le loro analisi
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {leaderboard.slice(0, 6).map((entry, idx) => {
                      const tGrade = resolveOperatorGradeBadge(
                        entry.level,
                        entry.xp,
                      );
                      const isInspected = inspectedUserId === entry.userId;
                      return (
                        <div
                          key={entry.userId ?? `${entry.name}-${idx}`}
                          className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                            isInspected
                              ? "border-[#C5A059] bg-[#C5A059]/12"
                              : "border-white/10 bg-[#12141E]/85 hover:border-[#C5A059]/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                entry.userId && setViewingProfile(entry.userId)
                              }
                              className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059] to-[#E8C56A] shrink-0"
                            >
                              <Avatar
                                name={entry.name}
                                avatarUrl={entry.avatarUrl}
                                size="sm"
                              />
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  entry.userId && setViewingProfile(entry.userId)
                                }
                                className="font-display text-xs font-bold text-white hover:text-[#E8C56A] truncate block text-left"
                              >
                                {entry.name}
                              </button>
                              <p className="font-mono text-[9px] text-[#C5A059] flex items-center gap-1">
                                <Award className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{tGrade.code}</span>
                              </p>
                              <p className="font-mono text-[9px] text-slate-400 truncate">
                                {tGrade.title}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1 border-t border-white/6">
                            {entry.userId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setInspectedUserId(entry.userId!)}
                                  className="flex-1 py-1 px-2 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] hover:bg-[#C5A059]/25 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  Ispeziona
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setViewingProfile(entry.userId!)}
                                  className="py-1 px-2 rounded-lg bg-[#0A0B10] border border-white/10 text-slate-300 hover:text-white font-mono text-[9px] uppercase tracking-wider transition-colors"
                                >
                                  Scheda
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT FLANK: Interactive Public Profile Showcase & Directory */}
            <div className="hidden xl:block sticky top-0">
              <PublicProfilesShowcaseFlank
                currentUserId={currentUserId}
                inspectedUserId={inspectedUserId}
                onSelectTrader={(uid) => setInspectedUserId(uid)}
                onOpenFullProfile={(uid) => setViewingProfile(uid)}
                onStartChat={onStartChat}
                onOpenLightbox={setLightboxItem}
              />
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {viewingStories && (
        <StoryViewer
          groups={viewingStories.groups}
          startIndex={viewingStories.index}
          onClose={() => setViewingStories(null)}
        />
      )}
      {createConfig.open && (
        <CreatePostModal
          onClose={() => setCreateConfig((c) => ({ ...c, open: false }))}
          currentUserId={currentUserId}
          initialSphere={createConfig.sphere}
          initialIsStory={createConfig.isStory}
        />
      )}
      {viewingProfile && (
        <UserProfileModal
          userId={viewingProfile}
          currentUserId={currentUserId}
          onClose={() => setViewingProfile(null)}
          onStartChat={(u) => {
            setViewingProfile(null);
            onStartChat(u);
          }}
        />
      )}
      <MediaLightboxModal
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        onViewProfile={(uid) => setViewingProfile(uid)}
      />
    </div>
  );
}
