import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Loader2, MessageCircle, Plus, Search, Users } from "lucide-react";
import { getGetCommunityChannelContextQueryKey, useGetCommunityChannelContext, useGetFriends, type FriendListItem } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsDesktop } from "@/hooks/use-media-query";
import { parseSocialLocation, socialHref, type ConversationFilter } from "@/lib/chatTabs";
import { legacyCheckoutChannel, updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { socialText } from "@/lib/i18n/reorganizationSocial";
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

  const list = <aside aria-label={text("conversations")} className="flex h-full min-h-0 w-full shrink-0 flex-col border-border/60 bg-card/20 lg:w-64 lg:border-r">
    <div className="space-y-3 border-b border-border/60 p-3">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{text("conversations")}</h2><button type="button" onClick={() => setCreating(true)} aria-label={text("create")} title={text("create")} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="h-4 w-4" /></button></div>
      <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} aria-label={text("search")} placeholder={text("search")} className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" /></label>
      <div className="flex gap-1" role="group" aria-label={text("conversations")}>
        {(["all", "private", "community"] as const).map(filter => <button type="button" key={filter} aria-pressed={selection.filter === filter} onClick={() => setFilter(filter)} className={`min-h-11 flex-1 rounded-lg px-1 text-xs font-medium ${selection.filter === filter ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40"}`}>{text(filter)}</button>)}
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {busy && <div className="flex justify-center py-6" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {failed && <div role="alert" className="space-y-2 p-3 text-sm"><p>{t("common.load_error")}</p><button className="min-h-11 text-primary" onClick={() => { void mutual.refetch(); void friends.refetch(); void communities.refetch(); }}>{text("retry")}</button></div>}
      {selection.filter !== "community" && <section>
        <h3 className="px-2 py-3 text-xs font-semibold text-muted-foreground">{text("private")}</h3>
        {contacts.filter(p => matching(p.name)).map(p => <Link key={p.userId} href={socialHref("conversazioni", { peer: p.userId })} aria-current={selection.peerId === p.userId ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl p-3 ${selection.peerId === p.userId ? "bg-primary/10 text-primary" : "hover:bg-secondary/40"}`}><Avatar name={p.name} avatarUrl={p.avatarUrl} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span><MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}
        {!busy && contacts.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{text("noContacts")}</p>}
        <Link href={socialHref("social")} className="flex min-h-11 items-center gap-2 px-2 text-sm text-primary"><Search className="h-4 w-4" />{text("find")}</Link>
      </section>}
      {selection.filter !== "private" && <section>
        <h3 className="px-2 py-3 text-xs font-semibold text-muted-foreground">{text("myCommunity")}</h3>
        {(communities.data ?? []).filter(c => c.isMember && matching(c.name)).map(c => <Link key={c.id} href={socialHref("conversazioni", { community: c.id })} aria-current={selection.communityId === c.id ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl p-3 ${selection.communityId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary/40"}`}><Avatar name={c.name} avatarUrl={c.avatarUrl ?? null} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span></Link>)}
        {!busy && !communities.data?.some(c => c.isMember) && <p className="px-2 py-3 text-sm text-muted-foreground">{text("noCommunity")}</p>}
        <button type="button" onClick={() => setDiscover(value => !value)} aria-expanded={discover} className="flex min-h-11 items-center gap-2 px-2 text-sm text-primary"><Users className="h-4 w-4" />{text("explore")}</button>
        {discover && (communities.data ?? []).filter(c => !c.isMember && matching(c.name)).map(c => <Link key={c.id} href={socialHref("conversazioni", { community: c.id })} className="flex min-h-14 items-center gap-3 rounded-xl p-3 hover:bg-secondary/40"><Avatar name={c.name} avatarUrl={c.avatarUrl ?? null} size="sm" /><span className="min-w-0 flex-1 truncate text-sm">{c.name}</span></Link>)}
      </section>}
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
