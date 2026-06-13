import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import { getSharedKey, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetPublicKey,
  useSendChatMessage,
  useGetChatMessages,
  useGetUnreadCount,
  useGetProfile,
  getGetChatMessagesQueryKey,
  getGetFriendsQueryKey,
  getGetPendingFriendRequestsQueryKey,
  getGetPublicKeyQueryKey,
  getSearchUsersQueryKey,
  getGetUnreadCountQueryKey,
  useGetFriends,
  useGetPendingFriendRequests,
  useRespondToFriendRequest,
  useSearchUsers,
  useSendFriendRequest,
  type FriendListItem,
  type UserSearchResult,
} from "@workspace/api-client-react";
import {
  Send,
  MessageCircle,
  Shield,
  Loader2,
  LogIn,
  Globe,
  Lock,
  Trophy,
  Crown,
  Medal,
  Award,
  User,
  Heart,
  Plus,
  X,
  Camera,
  FileText,
  ArrowLeft,
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  Clock,
  Users,
  ChevronRight,
  Trash2,
  Smile,
  ImageIcon,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  PhoneCall,
  StopCircle,
  Reply,
  Hash,
  Volume2,
  Radio,
  Headphones,
  Settings2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Download,
  Paperclip,
  File,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
} from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { formatFileSize } from "@/lib/fileFormatting";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import {
  fetchLeaderboard,
  leaderboardQueryKey,
  type LeaderboardEntry,
} from "@/lib/leaderboardApi";
import { reportClientError } from "@/lib/clientErrorReporter";
import { ICE_SERVERS, COMMUNITY_EMOJIS } from "@/components/social/constants";
import { fmtDur, fileIcon } from "@/components/social/format";
import { Avatar } from "@/components/social/Avatar";
import { PositionBadge } from "@/components/social/PositionBadge";
import type {
  DecryptedMsg,
  Post,
  StoryGroup,
  SocialUser,
  PostComment,
  CommunityFile,
  SocialProfileResponse,
  CallSignal,
  VoiceSignal,
  FriendRelationshipStatus,
  FriendSearchResult,
  CommunityType,
  ChannelType,
  CommunityDetail,
  CommunityMsg,
  VoiceParticipant,
} from "@/components/social/types";
import {
  usePostComments,
  useCommunityFiles,
  useFeed,
  useStories,
  useMutualFollowers,
  useLeaderboard,
  useFollowStatus,
  useUserProfile,
  useSocialSearch,
  useFriendSearch,
  useCommunities,
  useCommunityDetail,
  useCommunityMessages,
  useVoicePresence,
} from "@/components/social/hooks";
import { UserProfileModal } from "@/components/social/UserProfileModal";
import { StoryViewer } from "@/components/social/StoryViewer";
import { CreatePostModal } from "@/components/social/CreatePostModal";
import { PostCard } from "@/components/social/PostCard";
import { SocialTab } from "@/components/social/SocialTab";
import { MessaggiTab } from "@/components/social/MessaggiTab";
import { ClassificaTab } from "@/components/social/ClassificaTab";
import { CommunityTab } from "@/components/social/CommunityTab";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = "social" | "messaggi" | "classifica" | "comunita";

export default function Chat() {
  const { language, t } = useLanguage();
  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("social");
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

  const handleStartChat = (u: SocialUser) => {
    setActiveTab("messaggi");
    setPendingChat(u);
  };

  useEffect(() => {
    if (activeTab === "messaggi" && pendingChat) {
      setPendingChat(null);
    }
  }, [activeTab]);

  if (authLoading)
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );

  if (!isAuthenticated)
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Globe className="w-16 h-16 mx-auto text-primary opacity-40" />
            <h2 className="text-xl font-bold font-mono tracking-tight">
              {t("chat.title")}
            </h2>
            <p className="text-muted-foreground">{t("chat.login_required")}</p>
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" /> {t("common.start")}
            </button>
          </div>
        </div>
      </PageLayout>
    );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "social",
      label: t("chat.tab.social"),
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: "messaggi",
      label: t("chat.tab.messages"),
      icon: <Lock className="w-4 h-4" />,
    },
    { id: "comunita", label: "Comunità", icon: <Radio className="w-4 h-4" /> },
    {
      id: "classifica",
      label: t("chat.tab.leaderboard"),
      icon: <Trophy className="w-4 h-4" />,
    },
  ];

  return (
    <PageLayout>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden flex flex-col min-h-0"
        style={{ height: "calc(100dvh - 180px)" }}
      >
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all whitespace-nowrap px-2 ${activeTab === tab.id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "social" && (
            <SocialTab
              currentUserId={user?.id ?? ""}
              onStartChat={handleStartChat}
            />
          )}
          {activeTab === "messaggi" && (
            <MessaggiTab currentUser={{ id: user?.id ?? "" }} />
          )}
          {activeTab === "comunita" && (
            <CommunityTab
              currentUserId={user?.id ?? ""}
              currentUserName={
                (user as any)?.name ?? (user as any)?.firstName ?? "Trader"
              }
            />
          )}
          {activeTab === "classifica" && (
            <ProUpgradeGate feature="leaderboard">
              <ClassificaTab currentUserId={user?.id ?? ""} />
            </ProUpgradeGate>
          )}
        </div>
      </motion.section>
    </PageLayout>
  );
}
