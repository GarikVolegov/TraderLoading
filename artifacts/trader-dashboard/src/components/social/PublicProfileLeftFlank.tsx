import {
  Sparkles,
  Dumbbell,
  TrendingUp,
  Trophy,
  Camera,
  Globe,
  User,
  Award,
  Flame,
  Plus,
  Eye,
  Check,
  X,
} from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { Avatar } from "./Avatar";
import { useUserProfile } from "./hooks";
import {
  resolveOperatorGradeBadge,
  type PostSphere,
} from "./PostCard";
import type { Post } from "./types";
import type { MediaLightboxItem } from "./MediaLightboxModal";

export type ChroniclesFilterId =
  | "all"
  | "vita"
  | "tempio"
  | "analisi"
  | "traguardo"
  | "media"
  | "miei";

export interface PendingRequestItem {
  id: number;
  senderName?: string | null;
  senderAvatar?: string | null;
}

export function PublicProfileLeftFlank({
  currentUserId,
  activeFilter,
  onSelectFilter,
  filterCounts,
  onOpenCreate,
  onInspectProfile,
  onViewProfileModal,
  onOpenLightbox,
  pendingFriendRequests,
  onRespondFriendRequest,
  isRespondingFriendRequest,
}: {
  currentUserId: string;
  activeFilter: ChroniclesFilterId;
  onSelectFilter: (filter: ChroniclesFilterId) => void;
  filterCounts: Record<ChroniclesFilterId, number>;
  onOpenCreate: (sphere?: PostSphere) => void;
  onInspectProfile: (userId: string) => void;
  onViewProfileModal: (userId: string) => void;
  onOpenLightbox: (item: MediaLightboxItem) => void;
  pendingFriendRequests: PendingRequestItem[];
  onRespondFriendRequest: (id: number, action: "accept" | "reject") => void;
  isRespondingFriendRequest?: boolean;
}) {
  const { data: myProfileData } = useUserProfile(currentUserId || null);
  const myProfile = myProfileData?.profile;
  const myPosts: Post[] = myProfileData?.posts ?? [];
  const followersCount = myProfileData?.followersCount ?? 0;
  const followingCount = myProfileData?.followingCount ?? 0;

  const grade = resolveOperatorGradeBadge(myProfile?.level, myProfile?.xp);
  const streak = (myProfile as { streak?: number } | undefined)?.streak ?? 0;
  const myMediaPosts = myPosts.filter((p) => Boolean(p.imageUrl)).slice(0, 3);

  const filterItems: {
    id: ChroniclesFilterId;
    label: string;
    sub: string;
    Icon: typeof Globe;
    accent: string;
  }[] = [
    {
      id: "all",
      label: "Tutto il Flusso",
      sub: "Vita, stile & analisi",
      Icon: Globe,
      accent: "text-[#E8C56A]",
    },
    {
      id: "vita",
      label: "Vita & Stile",
      sub: "Lifestyle, postazione, viaggi",
      Icon: Sparkles,
      accent: "text-[#E8C56A]",
    },
    {
      id: "tempio",
      label: "Tempio Fisico",
      sub: "Allenamento, routine, mindset",
      Icon: Dumbbell,
      accent: "text-emerald-400",
    },
    {
      id: "analisi",
      label: "Analisi & Mercato",
      sub: "Grafici, setup, visioni",
      Icon: TrendingUp,
      accent: "text-sky-400",
    },
    {
      id: "traguardo",
      label: "Traguardi & Eredità",
      sub: "Milestone & risultati",
      Icon: Trophy,
      accent: "text-amber-300",
    },
    {
      id: "media",
      label: "Galleria Fotografica",
      sub: "Scatti di vita e grafici",
      Icon: Camera,
      accent: "text-purple-300",
    },
    {
      id: "miei",
      label: "Il Mio Diario Pubblico",
      sub: "I tuoi post pubblicati",
      Icon: User,
      accent: "text-[#C5A059]",
    },
  ];

  return (
    <aside className="flex flex-col gap-3.5 w-full">
      {/* 1. LA TUA VETRINA PUBBLICA (MY PUBLIC PROFILE CARD) */}
      <div className="rounded-2xl border border-[#C5A059]/30 bg-gradient-to-b from-[#0E1018] to-[#090A0F] overflow-hidden shadow-lg">
        {/* Sovereign Cover */}
        <div className="relative h-20 bg-gradient-to-r from-[#1A150A] via-[#0F111A] to-[#1D170B] border-b border-[#C5A059]/25 p-3 flex items-start justify-between">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_left,#C5A059,transparent_70%)]" />
          <span className="relative z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#C5A059]/40 bg-black/60 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E8C56A]">
            <Award className="w-2.5 h-2.5 text-[#C5A059]" />
            {grade.code}
          </span>
          <span className="relative z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Profilo Pubblico
          </span>
        </div>

        <div className="px-4 pb-4 -mt-8 relative z-10 space-y-3.5">
          {/* Avatar + Name */}
          <div className="flex items-end justify-between gap-2">
            <button
              type="button"
              onClick={() => currentUserId && onViewProfileModal(currentUserId)}
              className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059] via-[#E8C56A] to-[#8C6D2E] shadow-lg hover:scale-105 transition-transform"
            >
              <Avatar
                name={myProfile?.name ?? "Operatore"}
                avatarUrl={myProfile?.avatarUrl}
                size="md"
              />
            </button>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-500/30 bg-amber-500/10 font-mono text-[10px] font-bold text-amber-300">
                <Flame className="w-3 h-3 text-amber-400" />
                {streak}g
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => currentUserId && onViewProfileModal(currentUserId)}
                className="font-display text-base font-bold text-white hover:text-[#E8C56A] transition-colors truncate text-left"
              >
                {myProfile?.name ?? "Il Tuo Profilo"}
              </button>
            </div>
            <p className="font-mono text-[10px] text-[#C5A059]/90 truncate">
              {grade.title} · Lv.{myProfile?.level ?? 1} ·{" "}
              {(myProfile?.xp ?? 0).toLocaleString()} XP
            </p>
          </div>

          {/* Public Stats Bar */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => currentUserId && onInspectProfile(currentUserId)}
              className="rounded-xl border border-white/8 bg-[#12141E] py-2 px-1.5 text-center hover:border-[#C5A059]/40 transition-colors"
            >
              <p className="font-mono text-xs font-bold text-white">
                {followersCount}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                Follower
              </p>
            </button>
            <button
              type="button"
              onClick={() => currentUserId && onInspectProfile(currentUserId)}
              className="rounded-xl border border-white/8 bg-[#12141E] py-2 px-1.5 text-center hover:border-[#C5A059]/40 transition-colors"
            >
              <p className="font-mono text-xs font-bold text-white">
                {followingCount}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                Seguiti
              </p>
            </button>
            <button
              type="button"
              onClick={() => onSelectFilter("miei")}
              className="rounded-xl border border-[#C5A059]/25 bg-[#C5A059]/10 py-2 px-1.5 text-center hover:border-[#C5A059]/50 transition-colors"
            >
              <p className="font-mono text-xs font-bold text-[#E8C56A]">
                {myPosts.length}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#E8C56A]/80">
                Post
              </p>
            </button>
          </div>

          {/* Mini-Bacheca Personale (Vita & Analisi) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                La Tua Vetrina (Vita &amp; Analisi)
              </span>
              <button
                type="button"
                onClick={() => currentUserId && onViewProfileModal(currentUserId)}
                className="font-mono text-[9px] text-[#E8C56A] hover:underline flex items-center gap-1"
              >
                <Eye className="w-2.5 h-2.5" />
                <span>Espandi</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {myMediaPosts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onOpenLightbox({
                      imageUrl: p.imageUrl!,
                      userId: p.userId,
                      userName: p.userName,
                      avatarUrl: p.avatarUrl,
                      content: p.content,
                      createdAt: p.createdAt,
                      likesCount: p.likesCount,
                    })
                  }
                  className="aspect-square rounded-lg overflow-hidden border border-[#C5A059]/25 bg-[#06070A] group relative"
                >
                  <img
                    src={p.imageUrl!}
                    alt="Tuo post"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                </button>
              ))}
              {Array.from({ length: Math.max(0, 3 - myMediaPosts.length) }).map(
                (_, idx) => {
                  const slotSphere: PostSphere =
                    idx === 0 ? "vita" : idx === 1 ? "tempio" : "analisi";
                  const slotLabel =
                    idx === 0 ? "+ Vita" : idx === 1 ? "+ Routine" : "+ Analisi";
                  return (
                    <button
                      key={`empty-slot-${idx}`}
                      type="button"
                      onClick={() => onOpenCreate(slotSphere)}
                      className="aspect-square rounded-lg border border-dashed border-[#C5A059]/30 bg-[#11131C]/60 hover:bg-[#C5A059]/12 hover:border-[#C5A059] flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#E8C56A] transition-all"
                      title="Aggiungi uno scatto alla tua vetrina pubblica"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span className="font-mono text-[8px] uppercase tracking-wider">
                        {slotLabel}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => currentUserId && onViewProfileModal(currentUserId)}
            className="w-full py-2 px-3 rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/12 hover:bg-[#C5A059]/22 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>Apri il Tuo Profilo Pubblico</span>
          </button>
        </div>
      </div>

      {/* 2. ESPLORA PER SFERA (FILTRI VITA & ANALISI) */}
      <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0A0B10] p-3.5 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#C5A059]">
            Sfere dei Profili Pubblici
          </span>
          <span className="font-mono text-[9px] text-slate-500 uppercase">
            Vita &amp; Mercato
          </span>
        </div>

        <div className="space-y-1">
          {filterItems.map((item) => {
            const Icon = item.Icon;
            const active = activeFilter === item.id;
            const count = filterCounts[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectFilter(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                  active
                    ? "border-[#C5A059]/60 bg-gradient-to-r from-[#C5A059]/20 to-[#C5A059]/5 text-white shadow-sm"
                    : "border-transparent bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      active
                        ? "border-[#C5A059]/50 bg-[#C5A059]/20"
                        : "border-white/10 bg-[#12131A]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold truncate">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {item.sub}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 ${
                    active
                      ? "bg-[#C5A059] text-black font-bold"
                      : "bg-[#12131A] text-slate-400 border border-white/10"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. RICHIESTE DI CONFRATELLANZA (IF ANY) */}
      {pendingFriendRequests.length > 0 && (
        <div className="rounded-2xl border border-[#C5A059]/35 bg-[#0A0B10] p-3.5 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#E8C56A]">
              {uiText("auto.ui.4555767847")}
            </p>
            <span className="px-2 py-0.5 rounded-full bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[10px] font-bold">
              {pendingFriendRequests.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingFriendRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-2.5 p-2.5 bg-[#12131A] rounded-xl border border-[#C5A059]/20"
              >
                <Avatar
                  name={request.senderName ?? "Trader"}
                  avatarUrl={request.senderAvatar}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {request.senderName ?? "Trader"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {uiText("auto.ui.a51a25e19b")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest(request.id, "accept")}
                    disabled={isRespondingFriendRequest}
                    title={uiText("auto.ui.ab8585e7c5")}
                    className="p-1.5 rounded-lg bg-[#C5A059]/20 text-[#E8C56A] hover:bg-[#C5A059]/30 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest(request.id, "reject")}
                    disabled={isRespondingFriendRequest}
                    title={uiText("auto.ui.68b880f2a6")}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
