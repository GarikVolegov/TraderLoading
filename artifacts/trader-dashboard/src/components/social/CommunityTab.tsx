import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ArrowLeft, UserPlus, Users, Hash, Volume2, Radio, Settings, Lock } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useToast } from "@/hooks/use-toast";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useCommunities, useCommunityDetail } from "./hooks";
import { CreateCommunityModal } from "./CreateCommunityModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { CommunitySettingsModal } from "./CommunitySettingsModal";
import { CommunityReviews } from "./CommunityReviews";
import { StarRating } from "./StarRating";
import { TextChannelView } from "./TextChannelView";
import { VoiceChannelView } from "./VoiceChannelView";
import { ChannelUnlockPanel } from "./ChannelUnlockPanel";
import { ChannelPricingModal } from "./ChannelPricingModal";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import { useSearch } from "wouter";
import { parseSocialLocation } from "@/lib/chatTabs";

export function CommunityTab({
  currentUserId,
  currentUserName,
  embedded = false,
  communityId = null,
  channelId = null,
  onChannelChange,
  onBack,
}: {
  currentUserId: string;
  currentUserName: string;
  embedded?: boolean;
  communityId?: number | null;
  channelId?: number | null;
  onChannelChange?: (id: number | null, replace?: boolean) => void;
  onBack?: () => void;
}) {
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const { t, language } = useLanguage();
  const { unlock } = parseSocialLocation(useSearch());
  const { toast } = useToast();
  const { data: communities = [], isLoading: loadingCommunities } =
    useCommunities();
  const [localCommunityId, setSelectedCommunityId] = useState<number | null>(
    null,
  );
  const [localChannelId, setSelectedChannelId] = useState<number | null>(
    null,
  );
  const selectedCommunityId = embedded ? communityId : localCommunityId;
  const selectedChannelId = embedded ? channelId : localChannelId;
  const { data: communityDetail, isLoading: loadingDetail, isError: detailFailed, refetch: refetchDetail } =
    useCommunityDetail(selectedCommunityId);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [pricingChannelId, setPricingChannelId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "communities" | "channels" | "content"
  >(embedded ? channelId ? "content" : "channels" : "communities");

  useEffect(() => {
    if (embedded) setMobilePanel(channelId ? "content" : "channels");
  }, [embedded, channelId]);

  const selectedChannel =
    communityDetail?.channels?.find((c) => c.id === selectedChannelId) ?? null;
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
      reportClientError(error, { context: "community join", toast, fallbackMessage: t("errors.mutation.generic") });
    }
  };

  const leaveCommunity = async (id: number) => {
    try {
      await apiFetch(`community/${id}/leave`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communities"] });
      if (embedded && onBack) { onBack(); return; }
      setSelectedCommunityId(null);
      setSelectedChannelId(null);
      setMobilePanel("communities");
    } catch (error) {
      reportClientError(error, { context: "community leave", toast, fallbackMessage: t("errors.mutation.generic") });
    }
  };

  const selectCommunity = (id: number) => {
    setSelectedCommunityId(id);
    setSelectedChannelId(null);
    setShowReviews(false);
    setMobilePanel("channels");
  };

  const selectChannel = (id: number) => {
    if (embedded) onChannelChange?.(id);
    setSelectedChannelId(id);
    setShowReviews(false);
    setMobilePanel("content");
  };

  const openReviews = () => {
    setShowReviews(true);
    setMobilePanel("content");
  };

  useEffect(() => {
    // A locked private community returns a cover-only payload (no channels).
    // Depend on channels.length too (not just the community id): a pending
    // join request approved elsewhere lands via a same-id background refetch
    // (refetchOnWindowFocus) that flips channels from absent to populated
    // without the id ever changing — without this dependency the effect
    // never re-fires and the content pane is stuck on the empty placeholder
    // even though the now-unlocked sidebar is visible and clickable.
    if (communityDetail?.channels?.length && !selectedChannelId && (!embedded || isDesktop)) {
      const chans = communityDetail.channels;
      // Prefer a channel the member can actually read (first unlocked text channel),
      // so opening a community doesn't dump them on a paywall by default.
      const first =
        chans.find((c) => c.type === "text" && !c.locked) ??
        chans.find((c) => !c.locked) ??
        chans.find((c) => c.type === "text") ??
        chans[0];
      if (first) {
        if (embedded) onChannelChange?.(first.id, true);
        else setSelectedChannelId(first.id);
      }
    }
  }, [communityDetail?.id, communityDetail?.channels?.length, selectedChannelId, communityDetail?.channels, embedded, isDesktop, onChannelChange]);

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
                  {uiText("auto.ui.c28dcf855a")}
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
                        {uiText("auto.ui.edc243eae0", { count: c.memberCount })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {discoverCommunities.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-1">
                  {uiText("auto.ui.b4aad9f0d8")}
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
                      <p className="text-[10px]">{uiText("auto.ui.edc243eae0", { count: c.memberCount })}</p>
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
                  {uiText("auto.ui.c2c4ac30ec")}
                </p>
                <button
                  onClick={() => setShowCreateCommunity(true)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  {uiText("auto.ui.eba55dd340")}
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
      <div className="flex flex-col h-full border-r border-[#C5A059]/25 bg-[#0A0B10] w-full lg:w-56 shrink-0 text-slate-200">
        <div className="px-3 py-3 border-b border-[#C5A059]/20 shrink-0 bg-[#0E0F16]/60">
          {communityDetail.bannerUrl && (
            <div
              className="h-14 -mx-3 -mt-3 mb-2 bg-cover bg-center border-b border-[#C5A059]/20"
              style={{ backgroundImage: `url(${communityDetail.bannerUrl})` }}
            />
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <button
              type="button"
              aria-label={socialText(language, "back")}
              onClick={() => embedded && onBack ? onBack() : setMobilePanel("communities")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:text-white lg:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center text-sm font-bold bg-[#12131A] border border-[#C5A059]/30 text-[#E8C56A] shrink-0">
              {communityDetail.avatarUrl ? (
                <img src={communityDetail.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                communityDetail.iconEmoji || (communityDetail.name ? communityDetail.name.charAt(0).toUpperCase() : "Ω")
              )}
            </span>
            <p
              className="font-bold text-sm truncate font-display text-white"
              style={communityDetail.accentColor ? { color: communityDetail.accentColor } : undefined}
            >
              {communityDetail.name}
            </p>
          </div>
          {communityDetail.description && (
            <p className="text-[10px] text-slate-400 leading-relaxed truncate font-sans">
              {communityDetail.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 font-mono text-[10px] text-slate-400">
            <Users className="w-3 h-3 text-[#C5A059]" />
            <span>
              {uiText("auto.ui.edc243eae0", { count: communityDetail.memberCount })}
            </span>
          </div>
          <button
            onClick={openReviews}
            title={t("community.review.title")}
            className="flex items-center gap-1.5 mt-1.5 hover:opacity-80 transition-opacity"
          >
            <StarRating value={communityDetail.ratingAvg ?? 0} readOnly size={11} />
            <span className="text-[10px] font-mono text-slate-400">
              {t("community.review.count", { count: communityDetail.ratingCount ?? 0 })}
            </span>
          </button>
          {communityDetail.isMember && canOpenSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] text-xs font-semibold hover:bg-[#C5A059]/20 transition-all font-mono"
            >
              <Settings className="w-3.5 h-3.5" />
              {t("community.settings.manage")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {(["text", "voice"] as const).map((type) => {
            const channels = (communityDetail.channels ?? []).filter(
              (c) => c.type === type,
            );
            if (channels.length === 0 && !canManageChannels) return null;
            return (
              <div key={type} className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="font-mono text-[9px] font-bold text-[#C5A059] uppercase tracking-widest">
                    {type === "text" ? uiText("auto.ui.db36ee74bb") : uiText("auto.ui.5cf4dba953")}
                  </p>
                  {canManageChannels && (
                    <button
                      onClick={() => setShowCreateChannel(true)}
                      className="p-1 rounded text-slate-400 hover:text-[#E8C56A] hover:bg-[#C5A059]/10 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {channels.map((ch) => {
                  const isPaid = !!ch.priceCents && ch.priceCents > 0;
                  return (
                  <div
                    key={ch.id}
                    className={`group flex items-center rounded-lg mx-1 transition-all ${
                      selectedChannelId === ch.id
                        ? "bg-[#C5A059]/15 border-l-2 border-[#C5A059] shadow-sm"
                        : "hover:bg-white/5"
                    }`}
                    style={{ width: "calc(100% - 8px)" }}
                  >
                    <button
                      onClick={() => selectChannel(ch.id)}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left transition-all ${
                        selectedChannelId === ch.id
                          ? "text-[#E8C56A] font-semibold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {ch.type === "text" ? (
                        <Hash className="w-3.5 h-3.5 shrink-0 text-[#C5A059]" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 shrink-0 text-[#C5A059]" />
                      )}
                      <span className="text-xs font-medium truncate font-mono">{ch.name}</span>
                      {ch.locked && <Lock className="w-3 h-3 shrink-0 text-[#C5A059]/80" />}
                      {isPaid && (
                        <span className="ml-auto font-mono text-[10px] text-[#C5A059] tabular-nums shrink-0">
                          {(ch.priceCents! / 100).toFixed(0)} {(ch.currency ?? "eur").toUpperCase()}
                        </span>
                      )}
                    </button>
                    {canManageChannels && (
                      <button
                        type="button"
                        onClick={() => setPricingChannelId(ch.id)}
                        aria-label={t("channel.access.pricing_title")}
                        className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-slate-400 hover:text-[#E8C56A] transition-opacity shrink-0"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-[#C5A059]/20 bg-[#0E0F16]/60 shrink-0">
          {communityDetail.isMember ? (
            communityDetail.myRole !== "owner" ? (
              <button
                onClick={() => leaveCommunity(communityDetail.id)}
                className="w-full text-[11px] font-mono text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors py-1.5 rounded-lg border border-transparent hover:border-red-500/20"
              >
                {uiText("auto.ui.b7cc70d51f")}
              </button>
            ) : null
          ) : communityDetail.joinRequestStatus === "pending" ? (
            <button
              disabled
              className="w-full py-2 bg-secondary text-muted-foreground rounded-lg text-xs font-semibold cursor-default"
            >
              {t("community.join.requested")}
            </button>
          ) : (
            <button
              onClick={() => joinCommunity(communityDetail.id)}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold font-mono text-xs uppercase tracking-wider hover:brightness-110 shadow-sm transition-all"
            >
              {communityDetail.locked
                ? communityDetail.joinRequestStatus === "rejected"
                  ? t("community.join.declined")
                  : t("community.join.request")
                : uiText("auto.ui.d7339a9583")}
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
      selectedChannel.locked ? (
        <ChannelUnlockPanel channel={selectedChannel} />
      ) : selectedChannel.type === "text" ? (
        <TextChannelView
          channel={selectedChannel}
          currentUserId={currentUserId}
          isOwnerOrAdmin={canManageFiles}
        />
      ) : (
        <VoiceChannelView
          key={`${currentUserId}:${selectedChannel.id}`}
          channel={selectedChannel}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )
    ) : (
      <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground">
        <div>
          {loadingDetail ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : detailFailed ? <div role="alert"><p>{t("common.load_error")}</p><button className="min-h-11 text-primary" onClick={() => { void refetchDetail(); }}>{socialText(language, "retry")}</button></div> : selectedChannelId && !selectedChannel ? <p>{socialText(language, "unavailable")}</p> :
          !selectedCommunityId ? (
            <>
              <Radio className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{uiText("chat.community.select_title")}</p>
              <p className="text-xs mt-1">
                {uiText("auto.ui.4129dbfd67")}
              </p>
            </>
          ) : !communityDetail?.isMember ? (
            <>
              <UserPlus className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{communityDetail?.name}</p>
              <p className="text-xs mt-1 mb-2">
                {uiText("auto.ui.edc243eae0", { count: communityDetail?.memberCount ?? 0 })}
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
              {communityDetail?.locked && (
                <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-3">
                  {t("community.join.locked_hint")}
                </p>
              )}
              {communityDetail?.joinRequestStatus === "pending" ? (
                <button
                  disabled
                  className="px-5 py-2.5 bg-secondary text-muted-foreground rounded-xl text-sm font-semibold cursor-default"
                >
                  {t("community.join.requested")}
                </button>
              ) : (
                <button
                  onClick={() =>
                    communityDetail && joinCommunity(communityDetail.id)
                  }
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {communityDetail?.locked
                    ? communityDetail?.joinRequestStatus === "rejected"
                      ? t("community.join.declined")
                      : t("community.join.request")
                    : uiText("auto.ui.5e5f5f332a")}
                </button>
              )}
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

  useEffect(() => {
    if (unlock !== "success" || !selectedChannel?.locked || !selectedCommunityId) return;
    // Checkout completion is not an entitlement: wait for the authoritative webhook.
    let attempts = 0;
    const timer = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["community", selectedCommunityId] });
      if (++attempts >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [unlock, selectedChannel?.locked, selectedCommunityId, qc]);

  if (embedded && !communityDetail) return <div className="flex h-full flex-col">
    <button onClick={onBack} className="flex min-h-11 items-center gap-2 border-b border-border/60 px-3 text-sm"><ArrowLeft className="h-4 w-4" />{socialText(language, "back")}</button>
    <div className="flex flex-1 items-center justify-center p-6 text-center">{loadingDetail ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div role="alert"><p>{t("common.load_error")}</p><button className="min-h-11 text-primary" onClick={() => { void refetchDetail(); }}>{socialText(language, "retry")}</button></div>}</div>
  </div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {unlock && (unlock === "cancel" || selectedChannel?.locked) && <div role="status" className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">{socialText(language, unlock === "success" ? "paymentWaiting" : "paymentCancelled")}</div>}
      {/* Mount one workspace: hidden duplicates also open sockets and microphone effects. */}
      {isDesktop ? (
      <div className="flex min-h-0 flex-1">
        {!embedded && communityListPanel}
        {channelPanel}
        <div className="flex-1 flex flex-col min-w-0">{contentArea}</div>
      </div>
      ) : (
      <div className="min-h-0 flex-1 flex flex-col">
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
                  type="button"
                  aria-label={uiText("common.back")}
                  onClick={() => { if (embedded) onChannelChange?.(null); setMobilePanel("channels"); }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-secondary/50 text-muted-foreground"
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
      )}

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
      {pricingChannelId != null && communityDetail && (() => {
        const ch = communityDetail.channels?.find((c) => c.id === pricingChannelId);
        return ch ? (
          <ChannelPricingModal channel={ch} onClose={() => setPricingChannelId(null)} />
        ) : null;
      })()}
    </div>
  );
}
