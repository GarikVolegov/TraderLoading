import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Hash, Loader2, MessageCircle, Plus, Search, Shield, Users } from "lucide-react";
import { getGetCommunityChannelContextQueryKey, useGetCommunityChannelContext, useGetFriends, type FriendListItem } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsDesktop } from "@/hooks/use-media-query";
import { parseSocialLocation, socialHref, type ConversationFilter } from "@/lib/chatTabs";
import { legacyCheckoutChannel, updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { useCommunities, useMutualFollowers } from "./hooks";
import { Avatar } from "./Avatar";
import type { SocialUser } from "./types";

const MessaggiTab = lazy(() => import("./MessaggiTab").then(m => ({ default: m.MessaggiTab })));
const CommunityTab = lazy(() => import("./CommunityTab").then(m => ({ default: m.CommunityTab })));
const CreateCommunityModal = lazy(() => import("./CreateCommunityModal").then(m => ({ default: m.CreateCommunityModal })));

export default function ConversationsWorkspace({ currentUserId, currentUserName }: { currentUserId: string; currentUserName: string }) {
  const { language, t } = useLanguage();
  const text = (key: Parameters<typeof socialText>[1]) => socialText(language, key);
  const isDesktop = useIsDesktop();
  const search = useSearch();
  const selection = parseSocialLocation(search);
  const [, navigate] = useLocation();
  const legacyChannel = legacyCheckoutChannel(search);
  const legacyContext = useGetCommunityChannelContext(legacyChannel ?? 0, { query: {
    queryKey: getGetCommunityChannelContextQueryKey(legacyChannel ?? 0),
    enabled: legacyChannel !== null, retry: false,
  } });
  useEffect(() => {
    if (legacyChannel && legacyContext.data?.channelId === legacyChannel) {
      navigate(`/chat${updateWorkspaceQuery(search, { community: String(legacyContext.data.communityId) })}`, { replace: true });
    }
  }, [legacyChannel, legacyContext.data, navigate, search]);
  const mutual = useMutualFollowers();
  const friends = useGetFriends();
  const communities = useCommunities();
  const [query, setQuery] = useState("");
  const [discover, setDiscover] = useState(false);
  const [creating, setCreating] = useState(false);
  const contacts = useMemo(() => {
    const result = new Map<string, SocialUser>();
    for (const peer of mutual.data ?? []) if (peer.userId) result.set(peer.userId, { ...peer, isMutual: true });
    for (const friend of (friends.data ?? []) as FriendListItem[]) result.set(friend.friendUserId, {
      userId: friend.friendUserId, name: friend.name, avatarUrl: friend.avatarUrl ?? null,
      hasKey: true, isMutual: result.get(friend.friendUserId)?.isMutual,
    });
    return Array.from(result.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mutual.data, friends.data]);
  const peer = contacts.find(p => p.userId === selection.peerId);
  const hasSelection = Boolean(selection.peerId || selection.communityId);
  const busy = mutual.isPending || friends.isPending || communities.isPending;
  const failed = mutual.isError || friends.isError || communities.isError;
  const matching = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const goBack = () => navigate(socialHref("conversazioni", { filter: selection.filter }));
  const setFilter = (filter: ConversationFilter) => navigate(socialHref("conversazioni", { filter }));
  const changeChannel = (id: number | null, replace = false) => navigate(`/chat${updateWorkspaceQuery(search, { t: "conversazioni", channel: id == null ? null : String(id), unlock: null })}`, { replace });

  const list = <aside aria-label={text("conversations")} className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-[#C5A059]/25 bg-[#0A0B10] text-slate-200 lg:w-72">
    <div className="space-y-3 border-b border-[#C5A059]/20 p-3.5 bg-[#0E0F16]/60 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
            <SigilIcon name="fratellanza" size={14} />
          </div>
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
            {text("conversations")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label={text("create")}
          title={text("create")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 transition-all"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-[#C5A059]/20 bg-[#12131A] px-3 focus-within:border-[#C5A059]/80 focus-within:ring-1 focus-within:ring-[#C5A059]/30 transition-all">
        <Search className="h-3.5 w-3.5 shrink-0 text-[#C5A059]/70" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label={text("search")}
          placeholder={text("search")}
          className="min-h-10 min-w-0 flex-1 bg-transparent font-mono text-xs text-white placeholder:text-slate-500 outline-none"
        />
      </label>

      <div className="flex gap-1 rounded-lg bg-[#07080C] p-1 border border-white/5" role="group" aria-label={text("conversations")}>
        {(["all", "private", "community"] as const).map(filter => (
          <button
            type="button"
            key={filter}
            aria-pressed={selection.filter === filter}
            onClick={() => setFilter(filter)}
            className={`min-h-8 flex-1 rounded-md px-1 font-mono text-[10px] uppercase tracking-wider transition-all ${
              selection.filter === filter
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            {text(filter)}
          </button>
        ))}
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-3">
      {busy && (
        <div className="flex justify-center py-8" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[#C5A059]" />
        </div>
      )}
      {failed && (
        <div role="alert" className="space-y-2 p-3 text-sm rounded-lg border border-red-500/20 bg-red-500/10 text-red-300">
          <p>{t("common.load_error")}</p>
          <button className="min-h-8 text-xs font-mono font-bold text-[#E8C56A] underline" onClick={() => { void mutual.refetch(); void friends.refetch(); void communities.refetch(); }}>
            {text("retry")}
          </button>
        </div>
      )}

      {selection.filter !== "private" && (
        <section className="space-y-1">
          <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5A059]">
              {text("myCommunity")}
            </span>
            <span className="font-mono text-[9px] text-slate-500">AGORÀ</span>
          </div>

          {(communities.data ?? []).filter(c => c.isMember && matching(c.name)).map(c => (
            <Link
              key={c.id}
              href={socialHref("conversazioni", { community: c.id })}
              aria-current={selection.communityId === c.id ? "page" : undefined}
              className={`group flex min-h-12 items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all ${
                selection.communityId === c.id
                  ? "bg-[#C5A059]/15 border-l-2 border-[#C5A059] text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="relative shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#12131A] text-[#E8C56A] font-mono text-xs font-bold shadow-inner">
                {c.name ? c.name.charAt(0).toUpperCase() : "Ω"}
              </div>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
              <Hash className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-[#C5A059] transition-colors" />
            </Link>
          ))}

          {!busy && !communities.data?.some(c => c.isMember) && (
            <p className="px-2 py-2 text-xs text-slate-500 leading-relaxed font-mono">
              {text("noCommunity")}
            </p>
          )}

          <button
            type="button"
            onClick={() => setDiscover(value => !value)}
            aria-expanded={discover}
            className="flex min-h-9 w-full items-center gap-2 px-2.5 rounded-md text-xs font-mono text-[#E8C56A] hover:bg-[#C5A059]/10 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{text("explore")}</span>
          </button>

          {discover && (communities.data ?? []).filter(c => !c.isMember && matching(c.name)).map(c => (
            <Link
              key={c.id}
              href={socialHref("conversazioni", { community: c.id })}
              className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5 text-slate-300 transition-colors"
            >
              <Avatar name={c.name} avatarUrl={c.avatarUrl ?? null} size="sm" />
              <span className="min-w-0 flex-1 truncate text-xs">{c.name}</span>
            </Link>
          ))}
        </section>
      )}

      {selection.filter !== "community" && (
        <section className="space-y-1 pt-1">
          <div className="flex items-center justify-between px-2 pt-2 pb-1.5 border-t border-[#C5A059]/15">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5A059]">
              {text("private")}
            </span>
            <span className="font-mono text-[9px] text-slate-500">CIFRATURA E2EE</span>
          </div>

          {contacts.filter(p => matching(p.name)).map(p => (
            <Link
              key={p.userId}
              href={socialHref("conversazioni", { peer: p.userId })}
              aria-current={selection.peerId === p.userId ? "page" : undefined}
              className={`group flex min-h-12 items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all ${
                selection.peerId === p.userId
                  ? "bg-[#C5A059]/15 border-l-2 border-[#C5A059] text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#10B981] border border-[#0A0B10]" />
              </div>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-[#C5A059] transition-colors" />
            </Link>
          ))}

          {!busy && contacts.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-500 leading-relaxed font-mono">
              {text("noContacts")}
            </p>
          )}

          <Link
            href={socialHref("social")}
            className="flex min-h-9 items-center gap-2 px-2.5 rounded-md text-xs font-mono text-[#E8C56A] hover:bg-[#C5A059]/10 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{text("find")}</span>
          </Link>
        </section>
      )}
    </div>

    <div className="mt-auto shrink-0 border-t border-[#C5A059]/20 p-3 bg-[#0E0F16]/80">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[#E8C56A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-bold">Presidio Fratellanza</span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-500 whitespace-nowrap">
          E2EE · Attivo
        </span>
      </div>
      <div className="mt-1 text-[10px] text-slate-400 font-mono truncate">
        Canali dell&apos;Ordine in linea
      </div>
    </div>
  </aside>;

  const content = <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
    {selection.peerId ? (peer
      ? <MessaggiTab key={`${currentUserId}:${peer.userId}`} currentUser={{ id: currentUserId }} initialPeer={peer} embedded navigation={list} onBack={goBack} />
      : <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : text("unavailable")}</div>)
      : selection.communityId ? <CommunityTab key={`${currentUserId}:${selection.communityId}`} currentUserId={currentUserId} currentUserName={currentUserName} embedded communityId={selection.communityId} channelId={selection.channelId} onChannelChange={changeChannel} onBack={goBack} />
      : <MessaggiTab key={`${currentUserId}:inbox`} currentUser={{ id: currentUserId }} embedded navigation={list} onBack={goBack} />}
  </Suspense>;

  if (legacyChannel) return <div className="flex h-full items-center justify-center p-6" role={legacyContext.isError ? "alert" : "status"}>
    {legacyContext.isError ? <div className="space-y-3 text-center"><p>{text("unavailable")}</p><button className="min-h-11 text-primary" onClick={() => void legacyContext.refetch()}>{text("retry")}</button><div><Link href={socialHref("conversazioni")}>{text("back")}</Link></div></div> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}
  </div>;
  return <>
    {(!selection.communityId && (!selection.peerId || peer)) ? content : <div className="flex h-full min-h-0">
      {(isDesktop || !hasSelection) && list}
      {(isDesktop || hasSelection) && <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{content}</div>}
    </div>}
    {creating && <Suspense fallback={null}><CreateCommunityModal currentUserId={currentUserId} onClose={() => setCreating(false)} /></Suspense>}
  </>;
}
