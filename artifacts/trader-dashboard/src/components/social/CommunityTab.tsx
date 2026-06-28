import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ArrowLeft, UserPlus, Users, Hash, Volume2, Radio, Settings, Star } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useCommunities, useCommunityDetail } from "./hooks";
import { CreateCommunityModal } from "./CreateCommunityModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { CommunitySettingsModal } from "./CommunitySettingsModal";
import { CommunityReviews } from "./CommunityReviews";
import { StarRating } from "./StarRating";
import { TextChannelView } from "./TextChannelView";
import { VoiceChannelView } from "./VoiceChannelView";

export function CommunityTab({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { data: communities = [], isLoading: loadingCommunities } =
    useCommunities();
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(
    null,
  );
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null,
  );
  const { data: communityDetail, isLoading: loadingDetail } =
    useCommunityDetail(selectedCommunityId);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "communities" | "channels" | "content"
  >("communities");

  const selectedChannel =
    communityDetail?.channels.find((c) => c.id === selectedChannelId) ?? null;
  const myPerms = communityDetail?.myPermissions ?? [];
  const isOwner = communityDetail?.isOwner ?? false;
  const can = (p: string) => isOwner || myPerms.includes(p);
  const canManageChannels = can("channels.manage");
  const canManageFiles = can("files.manage");
  const canOpenSettings =
    isOwner ||
    ["roles.manage", "members.kick", "members.ban", "members.mute", "community.manage", "channels.manage"].some(
      (p) => myPerms.includes(p),
    );

  const joinCommunity = async (id: number) => {
    try {
      await apiJSON(`community/${id}/join`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["communities"] });
      qc.invalidateQueries({ queryKey: ["community", id] });
    } catch (error) {
      reportClientError(error, { context: "community join", notify: false });
    }
  };

  const leaveCommunity = async (id: number) => {
    try {
      await apiFetch(`community/${id}/leave`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communities"] });
      setSelectedCommunityId(null);
      setSelectedChannelId(null);
      setMobilePanel("communities");
    } catch (error) {
      reportClientError(error, { context: "community leave", notify: false });
    }
  };

  const selectCommunity = (id: number) => {
    setSelectedCommunityId(id);
    setSelectedChannelId(null);
    setShowReviews(false);
    setMobilePanel("channels");
  };

  const selectChannel = (id: number) => {
    setSelectedChannelId(id);
    setShowReviews(false);
    setMobilePanel("content");
  };

  const openReviews = () => {
    setShowReviews(true);
    setMobilePanel("content");
  };

  useEffect(() => {
    if (communityDetail?.channels.length && !selectedChannelId) {
      const first =
        communityDetail.channels.find((c) => c.type === "text") ??
        communityDetail.channels[0];
      if (first) setSelectedChannelId(first.id);
    }
  }, [communityDetail?.id]);

  const myCommunities = communities.filter((c) => c.isMember);
  const discoverCommunities = communities.filter((c) => !c.isMember);

  const communityListPanel = (
    <div className="flex flex-col h-full border-r border-border bg-card/20 w-full lg:w-60 shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">{uiText("auto.ui.19b6cbab8d")}</span>
        </div>
        <button
          onClick={() => setShowCreateCommunity(true)}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title={uiText("auto.ui.c6d5037ec3")}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loadingCommunities ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {myCommunities.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-1">
                  Le tue
                </p>
                {myCommunities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCommunity(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-secondary/40 ${selectedCommunityId === c.id ? "bg-primary/10 text-primary border-r-2 border-primary" : "text-foreground"}`}
                  >
                    <span className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center text-xl leading-none shrink-0">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.iconEmoji
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.memberCount} membri
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {discoverCommunities.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-1">
                  Scopri
                </p>
                {discoverCommunities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCommunity(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-secondary/40 text-muted-foreground hover:text-foreground ${selectedCommunityId === c.id ? "bg-secondary/40 text-foreground" : ""}`}
                  >
                    <span className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center text-xl leading-none shrink-0 opacity-70">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.iconEmoji
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-[10px]">{c.memberCount} membri</p>
                      {(c.ratingCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <StarRating value={c.ratingAvg ?? 0} readOnly size={9} />
                          <span className="text-[9px]">{(c.ratingAvg ?? 0).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {communities.length === 0 && (
              <div className="text-center py-8 px-4">
                <Radio className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nessuna community ancora
                </p>
                <button
                  onClick={() => setShowCreateCommunity(true)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Crea la prima!
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const channelPanel =
    selectedCommunityId && communityDetail ? (
      <div className="flex flex-col h-full border-r border-border bg-card/30 w-full lg:w-52 shrink-0">
        <div className="px-3 py-3 border-b border-border shrink-0">
          {communityDetail.bannerUrl && (
            <div
              className="h-14 -mx-3 -mt-3 mb-2 bg-cover bg-center"
              style={{ backgroundImage: `url(${communityDetail.bannerUrl})` }}
            />
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <button
              onClick={() => setMobilePanel("communities")}
              className="lg:hidden p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center text-xl shrink-0">
              {communityDetail.avatarUrl ? (
                <img src={communityDetail.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                communityDetail.iconEmoji
              )}
            </span>
            <p
              className="font-bold text-sm truncate"
              style={communityDetail.accentColor ? { color: communityDetail.accentColor } : undefined}
            >
              {communityDetail.name}
            </p>
            {communityDetail.isMember && canOpenSettings && (
              <button
                onClick={() => setShowSettings(true)}
                aria-label={t("community.settings.open")}
                title={t("community.settings.open")}
                className="ml-auto p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {communityDetail.description && (
            <p className="text-[10px] text-muted-foreground leading-relaxed truncate">
              {communityDetail.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {communityDetail.memberCount} membri
            </span>
          </div>
          <button
            onClick={openReviews}
            title={t("community.review.title")}
            className="flex items-center gap-1.5 mt-1.5 hover:opacity-80 transition-opacity"
          >
            <StarRating value={communityDetail.ratingAvg ?? 0} readOnly size={11} />
            <span className="text-[10px] text-muted-foreground">
              {t("community.review.count", { count: communityDetail.ratingCount ?? 0 })}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {(["text", "voice"] as const).map((type) => {
            const channels = communityDetail.channels.filter(
              (c) => c.type === type,
            );
            if (channels.length === 0 && !canManageChannels) return null;
            return (
              <div key={type} className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {type === "text" ? "Testo" : "Voce"}
                  </p>
                  {canManageChannels && (
                    <button
                      onClick={() => setShowCreateChannel(true)}
                      className="p-0.5 rounded hover:text-primary text-muted-foreground transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => selectChannel(ch.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all hover:bg-secondary/40 rounded-lg mx-1 ${selectedChannelId === ch.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    style={{ width: "calc(100% - 8px)" }}
                  >
                    {ch.type === "text" ? (
                      <Hash className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">
                      {ch.name}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-border shrink-0">
          {communityDetail.isMember ? (
            communityDetail.myRole !== "owner" ? (
              <button
                onClick={() => leaveCommunity(communityDetail.id)}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1.5 rounded-lg hover:bg-destructive/10"
              >
                Lascia community
              </button>
            ) : null
          ) : (
            <button
              onClick={() => joinCommunity(communityDetail.id)}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Unisciti
            </button>
          )}
        </div>
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground lg:flex hidden">
        <div>
          <Radio className="w-12 h-12 mx-auto opacity-20 mb-3" />
          <p className="text-sm font-medium">{uiText("auto.ui.98da329dd3")}</p>
          <p className="text-xs mt-1">{uiText("auto.ui.9de5f4bb17")}</p>
        </div>
      </div>
    );

  const contentArea =
    showReviews && communityDetail ? (
      <CommunityReviews detail={communityDetail} />
    ) : selectedChannel && communityDetail?.isMember ? (
      selectedChannel.type === "text" ? (
        <TextChannelView
          channel={selectedChannel}
          currentUserId={currentUserId}
          isOwnerOrAdmin={canManageFiles}
        />
      ) : (
        <VoiceChannelView
          channel={selectedChannel}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )
    ) : (
      <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground">
        <div>
          {!selectedCommunityId ? (
            <>
              <Radio className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{uiText("chat.community.select_title")}</p>
              <p className="text-xs mt-1">
                Unisciti o creane una nuova per iniziare
              </p>
            </>
          ) : !communityDetail?.isMember ? (
            <>
              <UserPlus className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{communityDetail?.name}</p>
              <p className="text-xs mt-1 mb-2">
                {communityDetail?.memberCount} membri
              </p>
              {(communityDetail?.ratingCount ?? 0) > 0 && (
                <button
                  onClick={openReviews}
                  className="flex items-center justify-center gap-1.5 mb-3 mx-auto hover:opacity-80 transition-opacity"
                >
                  <StarRating value={communityDetail?.ratingAvg ?? 0} readOnly size={14} />
                  <span className="text-xs text-muted-foreground">
                    {t("community.review.count", { count: communityDetail?.ratingCount ?? 0 })}
                  </span>
                </button>
              )}
              {communityDetail?.welcomeMessage && (
                <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4 whitespace-pre-line">
                  {communityDetail.welcomeMessage}
                </p>
              )}
              <button
                onClick={() =>
                  communityDetail && joinCommunity(communityDetail.id)
                }
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Unisciti alla community
              </button>
            </>
          ) : (
            <>
              <Hash className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{uiText("auto.ui.a0dc7b6549")}</p>
            </>
          )}
        </div>
      </div>
    );

  return (
    <>
      {/* Desktop: 3 panels side by side */}
      <div className="hidden lg:flex h-full">
        {communityListPanel}
        {channelPanel}
        <div className="flex-1 flex flex-col min-w-0">{contentArea}</div>
      </div>

      {/* Mobile: stacked panels with back navigation */}
      <div className="lg:hidden h-full flex flex-col">
        <AnimatePresence mode="wait">
          {mobilePanel === "communities" && (
            <motion.div
              key="communities"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              {communityListPanel}
            </motion.div>
          )}
          {mobilePanel === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              {channelPanel}
            </motion.div>
          )}
          {mobilePanel === "content" && (
            <motion.div
              key="content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-card/20">
                <button
                  onClick={() => setMobilePanel("channels")}
                  className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {selectedChannel && (
                  <div className="flex items-center gap-1.5">
                    {selectedChannel.type === "text" ? (
                      <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold">
                      {selectedChannel.name}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-hidden">{contentArea}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCreateCommunity && (
        <CreateCommunityModal
          onClose={() => setShowCreateCommunity(false)}
          currentUserId={currentUserId}
        />
      )}
      {showCreateChannel && selectedCommunityId && (
        <CreateChannelModal
          communityId={selectedCommunityId}
          onClose={() => setShowCreateChannel(false)}
        />
      )}
      {showSettings && communityDetail && (
        <CommunitySettingsModal
          detail={communityDetail}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
