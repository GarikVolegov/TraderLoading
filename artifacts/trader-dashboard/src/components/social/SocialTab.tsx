import { useState, useMemo } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetFriendsQueryKey, getGetPendingFriendRequestsQueryKey, getSearchUsersQueryKey, useGetPendingFriendRequests, useRespondToFriendRequest, useSendFriendRequest } from "@workspace/api-client-react";
import { Loader2, Globe, Plus, X, Search, UserPlus, UserMinus, Users } from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { Avatar } from "./Avatar";
import { useFeed, useStories, useSocialSearch, useFriendSearch } from "./hooks";
import type { StoryGroup, SocialUser, FriendSearchResult } from "./types";
import { UserProfileModal } from "./UserProfileModal";
import { StoryViewer } from "./StoryViewer";
import { CreatePostModal } from "./CreatePostModal";
import { PostCard } from "./PostCard";

export function SocialTab({
  currentUserId,
  onStartChat,
}: {
  currentUserId: string;
  onStartChat: (u: SocialUser) => void;
}) {
  const { data: feed = [], isLoading: feedLoading } = useFeed();
  const { data: storyGroups = [] } = useStories();
  const [viewingStories, setViewingStories] = useState<{
    groups: StoryGroup[];
    index: number;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { data: searchResults = [] } = useSocialSearch(searchQ);
  const { data: friendSearchResults = [] } = useFriendSearch(searchQ);
  const { data: pendingFriendRequests = [] } = useGetPendingFriendRequests();
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
    },
  });
  const unfollow = useMutation({
    mutationFn: (uid: string) =>
      apiJSON(`social/follow/${uid}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/search", searchQ] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary shrink-0" />
          {showSearch ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={uiText("auto.ui.244dbe72f9")}
                autoFocus
                className="w-full pl-9 pr-4 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ) : (
            <p className="font-semibold text-sm">{uiText("auto.ui.41a575086b")}</p>
          )}
        </div>
        <button
          onClick={() => {
            setShowSearch((s) => !s);
            setSearchQ("");
          }}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
        >
          {showSearch ? (
            <X className="w-4 h-4" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showSearch && searchQ.length >= 2 ? (
          <div className="p-4 space-y-2">
            {searchResults.map(
              (u) =>
                u.userId && (
                  <div
                    key={u.userId}
                    className="flex items-center gap-3 p-3 bg-card/40 rounded-xl border border-border"
                  >
                    <button onClick={() => setViewingProfile(u.userId!)}>
                      <Avatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                    </button>
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => setViewingProfile(u.userId!)}
                    >
                      <p className="text-sm font-semibold truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Lv.{u.level} · {u.xp?.toLocaleString()} XP
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {u.isMutual && (
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                          Mutual
                        </span>
                      )}
                      {(() => {
                        const relationshipStatus = friendStatusByUserId.get(u.userId!) ?? "none";
                        if (relationshipStatus === "accepted") {
                          return (
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1">
                              Già amico
                            </span>
                          );
                        }
                        if (relationshipStatus === "pending_sent") {
                          return (
                            <span className="text-[10px] bg-secondary/60 text-muted-foreground border border-border rounded-full px-2 py-1">
                              Richiesta inviata
                            </span>
                          );
                        }
                        if (relationshipStatus === "pending_received") {
                          return (
                            <button
                              onClick={() => setShowSearch(false)}
                              className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                            >
                              Rispondi
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => sendFriendRequestMutation.mutate({ data: { friendUserId: u.userId! } })}
                            disabled={sendFriendRequestMutation.isPending}
                            className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                          >
                            Aggiungi amico
                          </button>
                        );
                      })()}
                      {u.isFollowing ? (
                        <button
                          onClick={() => unfollow.mutate(u.userId!)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
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
            {searchResults.length === 0 && searchQ.length >= 2 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nessun utente trovato
              </p>
            )}
          </div>
        ) : (
          <>
            {pendingFriendRequests.length > 0 && (
              <div className="p-4 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Richieste amicizia
                </p>
                <div className="space-y-2">
                  {pendingFriendRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 bg-card/40 rounded-xl border border-border"
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
                          Vuole aggiungerti agli amici
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          respondToFriendRequestMutation.mutate({
                            id: request.id,
                            data: { action: "accept" },
                          })
                        }
                        disabled={respondToFriendRequestMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        Accetta
                      </button>
                      <button
                        onClick={() =>
                          respondToFriendRequestMutation.mutate({
                            id: request.id,
                            data: { action: "reject" },
                          })
                        }
                        disabled={respondToFriendRequestMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        Rifiuta
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {storyGroups.length > 0 && (
              <div className="p-4 border-b border-border shrink-0">
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                  <div
                    onClick={() => setShowCreate(true)}
                    className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Aggiungi
                    </span>
                  </div>
                  {storyGroups.map((group, i) => (
                    <div
                      key={group.userId}
                      onClick={() =>
                        setViewingStories({ groups: storyGroups, index: i })
                      }
                      className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
                    >
                      <div
                        className={`p-0.5 rounded-full ${group.isOwn ? "bg-gradient-to-tr from-primary to-primary/60" : "bg-gradient-to-tr from-pink-500 to-orange-400"}`}
                      >
                        <Avatar
                          name={group.userName}
                          avatarUrl={group.avatarUrl}
                          size="md"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[56px]">
                        {group.isOwn ? "Tu" : group.userName.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {storyGroups.length === 0 && (
              <div className="px-4 pt-4">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-3 p-3 bg-card/40 border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{uiText("chat.story.add")}</p>
                    <p className="text-xs">
                      Condividi il tuo trading per 24 ore
                    </p>
                  </div>
                </button>
              </div>
            )}

            <div className="p-4 space-y-4">
              {feedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : feed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-3">
                  <Users className="w-12 h-12 mx-auto opacity-20" />
                  <p className="font-medium">{uiText("chat.feed.empty_title")}</p>
                  <p className="text-sm">
                    Cerca e segui altri trader per vedere i loro post!
                  </p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm hover:bg-primary/20 transition-colors"
                  >
                    <Search className="w-4 h-4" /> Cerca trader
                  </button>
                </div>
              ) : (
                feed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    onViewProfile={setViewingProfile}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {viewingStories && (
        <StoryViewer
          groups={viewingStories.groups}
          startIndex={viewingStories.index}
          onClose={() => setViewingStories(null)}
        />
      )}
      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          currentUserId={currentUserId}
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
    </div>
  );
}
