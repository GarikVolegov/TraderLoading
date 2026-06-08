import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DecryptedMsg {
  id: number;
  senderId: string;
  type: "text" | "image" | "voice" | "video" | "file";
  content: string;
  createdAt: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

interface Post {
  id: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  isStory: boolean;
  expiresAt: string | null;
  likesCount: number;
  createdAt: string;
  likedByMe?: boolean;
  isOwnPost?: boolean;
}

interface StoryGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  stories: Post[];
  isOwn: boolean;
}

interface SocialUser {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  level?: number;
  xp?: number;
  isFollowing?: boolean;
  isMutual?: boolean;
  hasKey?: boolean;
}

interface PostComment {
  id: number;
  postId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}

interface CommunityFile {
  id: number;
  channelId: number;
  communityId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  downloadable: boolean;
  createdAt: string;
}

interface SocialProfileResponse {
  profile: SocialUser;
  posts: Post[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isMutual: boolean;
  isOwnProfile: boolean;
}

interface CallSignal {
  callId: string;
  from: string;
  type: "offer" | "answer" | "ice" | "hangup";
  data: string;
}

interface VoiceSignal {
  from: string;
  type: "offer" | "answer" | "ice";
  data: string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

function usePostComments(postId: number | null) {
  return useQuery<PostComment[]>({
    queryKey: ["post-comments", postId],
    queryFn: () => apiJSON(`social/posts/${postId}/comments`),
    enabled: postId !== null,
    staleTime: 5000,
  });
}

function useCommunityFiles(channelId: number | null) {
  return useQuery<CommunityFile[]>({
    queryKey: ["communityFiles", channelId],
    queryFn: () => apiJSON(`community/channels/${channelId}/files`),
    enabled: channelId !== null,
    refetchInterval: 10_000,
    staleTime: 0,
  });
}

function fileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf")
    return <FileText className="w-4 h-4 text-red-400" />;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return <File className="w-4 h-4 text-green-400" />;
  if (mimeType.includes("word"))
    return <FileText className="w-4 h-4 text-blue-300" />;
  if (mimeType.includes("zip"))
    return <File className="w-4 h-4 text-yellow-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function useFeed() {
  return useQuery<(Post & { likedByMe: boolean; isOwnPost: boolean })[]>({
    queryKey: ["social/feed"],
    queryFn: () => apiJSON("social/feed"),
    refetchInterval: 8000,
  });
}

function useStories() {
  return useQuery<StoryGroup[]>({
    queryKey: ["social/stories"],
    queryFn: () => apiJSON("social/stories"),
    refetchInterval: 30000,
  });
}

function useMutualFollowers() {
  return useQuery<SocialUser[]>({
    queryKey: ["social/mutual-followers"],
    queryFn: () => apiJSON("social/mutual-followers"),
    refetchInterval: 15000,
  });
}

function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: leaderboardQueryKey,
    queryFn: () => fetchLeaderboard(),
  });
}

function useFollowStatus(targetId: string | null) {
  return useQuery<{ isFollowing: boolean; isMutual: boolean }>({
    queryKey: ["social/follow-status", targetId],
    queryFn: () => apiJSON(`social/follow-status/${targetId}`),
    enabled: !!targetId,
  });
}

function useUserProfile(userId: string | null) {
  return useQuery<SocialProfileResponse>({
    queryKey: ["social/profile", userId],
    queryFn: () => apiJSON(`social/profile/${userId}`),
    enabled: !!userId,
  });
}

function useSocialSearch(q: string) {
  return useQuery<SocialUser[]>({
    queryKey: ["social/search", q],
    queryFn: () => apiJSON(`social/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
}

type FriendRelationshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";
type FriendSearchResult = UserSearchResult & {
  relationshipStatus?: FriendRelationshipStatus;
};

function useFriendSearch(q: string) {
  return useSearchUsers({ q }, {
    query: {
      queryKey: getSearchUsersQueryKey({ q }),
      enabled: q.length >= 2,
    },
  });
}

// ─── Shared components ────────────────────────────────────────────────────────

function Avatar({
  name,
  avatarUrl,
  size = "md",
  ring,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  ring?: string;
}) {
  const s =
    size === "xs"
      ? "w-7 h-7 text-[10px]"
      : size === "sm"
        ? "w-9 h-9 text-xs"
        : size === "lg"
          ? "w-16 h-16 text-xl"
          : "w-10 h-10 text-sm";
  const ringCls = ring ? `ring-2 ${ring}` : "";
  if (avatarUrl)
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${s} ${ringCls} rounded-full object-cover border border-border flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${s} ${ringCls} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1)
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
        <Crown className="w-4 h-4 text-yellow-400" />
      </div>
    );
  if (position === 2)
    return (
      <div className="w-8 h-8 rounded-full bg-slate-300/20 border border-slate-400/50 flex items-center justify-center">
        <Medal className="w-4 h-4 text-slate-300" />
      </div>
    );
  if (position === 3)
    return (
      <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600/50 flex items-center justify-center">
        <Award className="w-4 h-4 text-amber-600" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-secondary/50 border border-border flex items-center justify-center">
      <span className="text-xs font-bold font-mono text-muted-foreground">
        #{position}
      </span>
    </div>
  );
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

function UserProfileModal({
  userId,
  currentUserId,
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

  const follow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/follow-status", userId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
    },
  });
  const unfollow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/follow-status", userId] });
      qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
    },
  });

  if (isLoading)
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
      >
        <div
          className="bg-card rounded-2xl p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );

  const {
    profile,
    posts,
    followersCount,
    followingCount,
    isFollowing,
    isMutual,
    isOwnProfile,
  } = data ?? {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={profile?.name ?? "?"}
                avatarUrl={profile?.avatarUrl}
                size="lg"
                ring="ring-primary/40"
              />
              <div>
                <p className="font-bold text-lg">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Livello {profile?.level} · {profile?.xp?.toLocaleString()} XP
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-6 mb-4 text-center">
            <div>
              <p className="font-bold">{followersCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Follower</p>
            </div>
            <div>
              <p className="font-bold">{followingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div>
              <p className="font-bold">{posts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Post</p>
            </div>
          </div>

          {!isOwnProfile && (
            <div className="flex gap-2 mb-5">
              {isFollowing ? (
                <button
                  onClick={() => unfollow.mutate()}
                  disabled={unfollow.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <UserMinus className="w-4 h-4" /> Smetti di seguire
                </button>
              ) : (
                <button
                  onClick={() => follow.mutate()}
                  disabled={follow.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Segui
                </button>
              )}
              {isMutual && onStartChat && (
                <button
                  onClick={() => {
                    onStartChat({
                      userId,
                      name: profile?.name ?? "Trader",
                      avatarUrl: profile?.avatarUrl ?? null,
                      isMutual: true,
                    });
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <Lock className="w-4 h-4" /> Messaggio
                </button>
              )}
            </div>
          )}

          {isMutual && !isOwnProfile && (
            <div className="flex items-center gap-1.5 text-xs text-primary mb-4 bg-primary/10 rounded-lg px-3 py-2">
              <UserCheck className="w-3.5 h-3.5" /> Si seguono a vicenda · Chat
              disponibile
            </div>
          )}

          {posts && posts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                Post
              </p>
              <div className="space-y-3">
                {posts.map((p: Post) => (
                  <div
                    key={p.id}
                    className="bg-secondary/30 rounded-xl p-3 text-sm"
                  >
                    <p className="text-foreground/90 whitespace-pre-wrap">
                      {p.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {p.likesCount}
                      </span>
                      <span>
                        {formatIntlRelativeTime(p.createdAt, language)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────

function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  // Reply state
  const [showReply, setShowReply] = useState(false);
  const [replyTab, setReplyTab] = useState<
    "text" | "emoji" | "image" | "voice"
  >("text");
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [replyImgUploading, setReplyImgUploading] = useState(false);
  const [replyRecording, setReplyRecording] = useState(false);
  const [replyBlob, setReplyBlob] = useState<Blob | null>(null);
  const [replyDuration, setReplyDuration] = useState(0);
  const replyMrRef = useRef<MediaRecorder | null>(null);
  const replyChunksRef = useRef<Blob[]>([]);
  const replyTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const replyFileRef = useRef<HTMLInputElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const totalInGroup = group?.stories.length ?? 1;

  useEffect(() => {
    setProgress(0);
    clearInterval(intervalRef.current);
    if (paused || showReply) return;
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          advance();
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [groupIdx, storyIdx, paused, showReply]);

  const advance = () => {
    if (storyIdx < totalInGroup - 1) setStoryIdx((s) => s + 1);
    else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else onClose();
  };

  if (!story) return null;
  const timeLeft = story.expiresAt
    ? Math.max(
        0,
        Math.floor(
          (new Date(story.expiresAt).getTime() - Date.now()) / 3600000,
        ),
      )
    : 0;

  const sendStoryReply = async (content: string, type = "text") => {
    try {
      await apiFetch(`social/story-reply/${story.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type }),
      });
      setReplySent(true);
      setTimeout(() => {
        setReplySent(false);
        setShowReply(false);
        setReplyText("");
        setReplyBlob(null);
      }, 1500);
    } catch (err) {
      console.error("Reply error:", err);
    }
  };

  const handleReplyImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("social/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { imageUrl } = await res.json();
      await sendStoryReply(imageUrl, "image");
    } catch (err) {
      console.error("Story image reply error:", err);
    } finally {
      setReplyImgUploading(false);
      if (replyFileRef.current) replyFileRef.current.value = "";
    }
  };

  const startReplyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      replyChunksRef.current = [];
      mr.ondataavailable = (e) => replyChunksRef.current.push(e.data);
      mr.onstop = () => {
        setReplyBlob(new Blob(replyChunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      replyMrRef.current = mr;
      setReplyRecording(true);
      setReplyDuration(0);
      replyTimerRef.current = setInterval(
        () => setReplyDuration((d) => d + 1),
        1000,
      );
    } catch {
      console.error("Mic error");
    }
  };

  const stopReplyRecording = () => {
    replyMrRef.current?.stop();
    clearInterval(replyTimerRef.current);
    setReplyRecording(false);
  };

  const sendReplyVoice = async () => {
    if (!replyBlob) return;
    const fd = new FormData();
    fd.append("audio", replyBlob, "reply.webm");
    try {
      const res = await apiFetch("social/upload-voice", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();
      const { audioUrl } = await res.json();
      await sendStoryReply(audioUrl, "voice");
      setReplyBlob(null);
      setReplyDuration(0);
    } catch {
      console.error("Voice reply error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="w-full max-w-sm h-full max-h-[700px] relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-3 z-10 flex gap-1">
          {group.stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden"
            >
              <div
                className={`h-full bg-white rounded-full ${i < storyIdx ? "w-full" : i === storyIdx ? "" : "w-0"}`}
                style={
                  i === storyIdx
                    ? { width: `${progress}%`, transition: "width 0.1s linear" }
                    : {}
                }
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 p-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar
              name={group.userName}
              avatarUrl={group.avatarUrl}
              size="sm"
              ring="ring-white/50"
            />
            <div>
              <p className="text-white text-sm font-semibold">
                {group.userName}
              </p>
              <p className="text-white/60 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeLeft}h rimaste
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Story content — tap to advance, but not on reply area */}
        <div
          className="absolute inset-0 flex items-center justify-center p-6 pt-24 pb-32"
          onClick={showReply ? undefined : advance}
        >
          {story.imageUrl ? (
            <img
              src={story.imageUrl}
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <p className="text-white text-lg text-center leading-relaxed font-medium">
              {story.content}
            </p>
          )}
          {story.imageUrl && story.content && (
            <p className="absolute bottom-36 left-0 right-0 text-white/90 text-sm text-center px-4">
              {story.content}
            </p>
          )}
        </div>

        {/* Reply area */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {!showReply ? (
            <div className="p-4 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReply(true);
                  setPaused(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium hover:bg-white/25 transition-colors"
              >
                <Reply className="w-4 h-4" /> Rispondi
              </button>
            </div>
          ) : (
            <div
              className="bg-black/80 backdrop-blur-md border-t border-white/10 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {replySent ? (
                <div className="text-center py-3 text-green-400 font-medium text-sm">
                  ✓ Risposta inviata!
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-2">
                    {(["text", "emoji", "image", "voice"] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          onClick={() => setReplyTab(tab)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${replyTab === tab ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"}`}
                        >
                          {tab === "text"
                            ? "Testo"
                            : tab === "emoji"
                              ? "😊"
                              : tab === "image"
                                ? "📷"
                                : "🎤"}
                        </button>
                      ),
                    )}
                  </div>

                  {replyTab === "text" && (
                    <div className="flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          replyText.trim() &&
                          sendStoryReply(replyText.trim())
                        }
                        placeholder="Scrivi una risposta..."
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40"
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          replyText.trim() && sendStoryReply(replyText.trim())
                        }
                        disabled={!replyText.trim()}
                        className="px-3 py-2 bg-white text-black rounded-xl disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {replyTab === "emoji" && (
                    <div className="space-y-2">
                      <EmojiPickerPanel
                        onSelect={(e) => sendStoryReply(e, "text")}
                      />
                    </div>
                  )}

                  {replyTab === "image" && (
                    <div className="flex items-center justify-center gap-3 py-2">
                      <button
                        onClick={() => replyFileRef.current?.click()}
                        disabled={replyImgUploading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/15 border border-white/20 rounded-xl text-white text-sm hover:bg-white/25 transition-colors disabled:opacity-50"
                      >
                        {replyImgUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {replyImgUploading ? "Caricamento..." : "Allega foto"}
                      </button>
                      <input
                        ref={replyFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReplyImage}
                      />
                    </div>
                  )}

                  {replyTab === "voice" && (
                    <div className="flex items-center gap-3 py-1">
                      {!replyBlob ? (
                        <button
                          onClick={
                            replyRecording
                              ? stopReplyRecording
                              : startReplyRecording
                          }
                          className={`flex items-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${replyRecording ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/15 text-white border border-white/20 hover:bg-white/25"}`}
                        >
                          {replyRecording ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span>{fmtDur(replyDuration)}</span>
                              <span className="ml-auto text-xs opacity-70">
                                Tocca per fermare
                              </span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" /> Tieni premuto per
                              registrare
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <audio
                            controls
                            src={URL.createObjectURL(replyBlob)}
                            className="flex-1 h-8"
                          />
                          <button
                            onClick={() => {
                              setReplyBlob(null);
                              setReplyDuration(0);
                            }}
                            className="p-2 text-white/60 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={sendReplyVoice}
                            className="p-2 bg-white text-black rounded-lg"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowReply(false);
                      setPaused(false);
                      setReplyText("");
                      setReplyBlob(null);
                    }}
                    className="w-full text-center text-white/40 text-xs py-1 hover:text-white/60"
                  >
                    Annulla
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

function CreatePostModal({
  onClose,
  currentUserId,
}: {
  onClose: () => void;
  currentUserId: string;
}) {
  const [content, setContent] = useState("");
  const [isStory, setIsStory] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: {
      content: string;
      isStory: boolean;
      imageUrl?: string;
    }) =>
      apiJSON("social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/stories"] });
      onClose();
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("social/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { imageUrl: url } = await res.json();
      setImageUrl(url);
    } catch {
      // silently fail
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
    setShowEmoji(false);
  };

  const handleSubmit = () => {
    if (!content.trim() && !imageUrl) return;
    createPost.mutate({
      content: content.trim(),
      isStory,
      imageUrl: imageUrl ?? undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">
            Nuovo {isStory ? "storia" : "post"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsStory(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${!isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <FileText className="w-4 h-4" /> Post
          </button>
          <button
            onClick={() => setIsStory(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <Clock className="w-4 h-4" /> Storia 24h
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isStory ? "Cosa vuoi condividere?" : "Cosa stai pensando?"
          }
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none transition-colors"
          autoFocus
        />

        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={imageUrl}
              alt="preview"
              className="w-full max-h-56 object-cover"
            />
            <button
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showEmoji && <EmojiPickerPanel onSelect={insertEmoji} />}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading || !!imageUrl}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              title="Aggiungi immagine"
            >
              {imageUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowEmoji((s) => !s)}
              className={`p-2 rounded-lg transition-colors ${showEmoji ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground ml-1">
              {content.length}/2000
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && !imageUrl) || createPost.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createPost.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Pubblica
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {isStory && (
          <p className="text-xs flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> La storia scomparirà
            automaticamente dopo 24 ore
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onViewProfile,
}: {
  post: Post & { likedByMe: boolean; isOwnPost: boolean };
  currentUserId: string;
  onViewProfile: (id: string) => void;
}) {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const { data: comments = [], isLoading: loadingComments } = usePostComments(
    showComments ? post.id : null,
  );

  const like = useMutation({
    mutationFn: () =>
      apiJSON(`social/posts/${post.id}/like`, { method: "POST" }),
    onSuccess: (data: { liked: boolean }) => {
      setLiked(data.liked);
      setCount((c) => (data.liked ? c + 1 : c - 1));
    },
  });

  const deletePost = useMutation({
    mutationFn: () => apiJSON(`social/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social/feed"] }),
  });

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content || submittingComment) return;
    setSubmittingComment(true);
    try {
      await apiJSON(`social/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    } catch (error) {
      reportClientError(error, {
        context: "social comment submit",
        notify: false,
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    try {
      await apiJSON(`social/posts/${post.id}/comments/${commentId}`, {
        method: "DELETE",
      });
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    } catch (error) {
      reportClientError(error, {
        context: "social comment delete",
        notify: false,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => onViewProfile(post.userId)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Avatar name={post.userName} avatarUrl={post.avatarUrl} size="sm" />
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">
                {post.userName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatIntlRelativeTime(post.createdAt, language)}
              </p>
            </div>
          </button>
          {post.isOwnPost && (
            <button
              onClick={() => deletePost.mutate()}
              disabled={deletePost.isPending}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mb-3">
          {post.content}
        </p>
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt="post"
            className="w-full rounded-xl mb-3 object-cover max-h-64"
          />
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={() => like.mutate()}
            className={`flex items-center gap-1.5 text-sm transition-all ${liked ? "text-red-400" : "text-muted-foreground hover:text-red-400"}`}
          >
            <motion.div
              animate={{ scale: liked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.2 }}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            </motion.div>
            <span className="font-medium">{count}</span>
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            className={`flex items-center gap-1.5 text-sm transition-all ${showComments ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">
              {comments.length > 0 ? comments.length : "Commenti"}
            </span>
          </button>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-border/50 bg-secondary/10">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">
                  Nessun commento ancora — scrivi il primo!
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 group">
                  <div className="w-6 h-6 rounded-full bg-secondary border border-border overflow-hidden shrink-0 mt-0.5">
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold">
                        {c.userName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-xs font-semibold ${c.userId === currentUserId ? "text-primary" : ""}`}
                      >
                        {c.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatIntlRelativeTime(c.createdAt, language)}
                      </span>
                      {c.userId === currentUserId && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed mt-0.5 break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-xl px-3 py-1.5">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), submitComment())
                }
                placeholder="Aggiungi un commento..."
                className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="w-5 h-5 rounded-md bg-primary/20 hover:bg-primary/40 text-primary flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                {submittingComment ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── SOCIAL TAB ───────────────────────────────────────────────────────────────

function SocialTab({
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
                placeholder="Cerca trader..."
                autoFocus
                className="w-full pl-9 pr-4 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ) : (
            <p className="font-semibold text-sm">Social</p>
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
                              Gia' amico
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
                    <p className="text-sm font-medium">Aggiungi una storia</p>
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
                  <p className="font-medium">Nessun post nel feed</p>
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

// ─── MESSAGGI TAB (E2EE con mutual followers) ─────────────────────────────────

function MessaggiTab({ currentUser }: { currentUser: { id: string } }) {
  const { toast } = useToast();
  const {
    keyPair,
    isReady: e2eeReady,
    error: e2eeError,
  } = useE2EEKeys(currentUser.id);
  const [selectedFriend, setSelectedFriend] = useState<SocialUser | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messageInput, setMessageInput] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMsg[]>(
    [],
  );
  const [showEmojiDM, setShowEmojiDM] = useState(false);
  const [dmImgUploading, setDmImgUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  // Voice call (WebRTC)
  const [callState, setCallState] = useState<
    "idle" | "calling" | "incoming" | "connected"
  >("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [callPeer, setCallPeer] = useState<SocialUser | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<{
    sdp: string;
    callId: string;
    from: string;
  } | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data: mutualFollowers = [], isLoading } = useMutualFollowers();
  const { data: acceptedFriends = [], isLoading: friendsLoading } = useGetFriends();
  const messageContacts = useMemo<SocialUser[]>(() => {
    const contacts = new Map<string, SocialUser>();
    for (const user of mutualFollowers as SocialUser[]) {
      if (user.userId) contacts.set(user.userId, { ...user, isMutual: true });
    }
    for (const friend of acceptedFriends as FriendListItem[]) {
      contacts.set(friend.friendUserId, {
        userId: friend.friendUserId,
        name: friend.name,
        avatarUrl: friend.avatarUrl ?? null,
        hasKey: true,
        isMutual: contacts.get(friend.friendUserId)?.isMutual,
      });
    }
    return Array.from(contacts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [acceptedFriends, mutualFollowers]);
  const { data: unreadData } = useGetUnreadCount({
    query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 5000 },
  });
  const { data: friendPublicKeyData } = useGetPublicKey(
    selectedFriend?.userId ?? "",
    {
      query: {
        queryKey: getGetPublicKeyQueryKey(selectedFriend?.userId ?? ""),
        enabled: !!selectedFriend?.userId,
      },
    },
  );
  const { data: messagesData, refetch: refetchMessages } = useGetChatMessages(
    selectedFriend?.userId ?? "",
    {},
    {
      query: {
        queryKey: getGetChatMessagesQueryKey(selectedFriend?.userId ?? "", {}),
        enabled: !!selectedFriend?.userId,
        refetchInterval: 3000,
      },
    },
  );
  const sendMessageMutation = useSendChatMessage();

  // Decrypt messages
  useEffect(() => {
    if (
      !messagesData?.messages ||
      !keyPair ||
      !friendPublicKeyData?.publicKeyJwk
    )
      return;
    const decrypt = async () => {
      try {
        const sharedKey = await getSharedKey(
          keyPair.privateKey,
          friendPublicKeyData.publicKeyJwk as JsonWebKey,
        );
        const decrypted = await Promise.all(
          messagesData.messages.map(async (msg): Promise<DecryptedMsg> => {
            const raw = await decryptMessage(msg.ciphertext, msg.iv, sharedKey);
            try {
              const obj = JSON.parse(raw);
              return {
                id: msg.id,
                senderId: msg.senderId,
                type: obj.type ?? "text",
                content: obj.content ?? obj.url ?? raw,
                fileName: obj.fileName,
                mimeType: obj.mimeType,
                size: obj.size,
                createdAt: msg.createdAt,
              };
            } catch {
              return {
                id: msg.id,
                senderId: msg.senderId,
                type: "text",
                content: raw,
                createdAt: msg.createdAt,
              };
            }
          }),
        );
        setDecryptedMessages(decrypted);
      } catch (err) {
        console.error("Decrypt error:", err);
      }
    };
    decrypt();
  }, [messagesData?.messages, keyPair, friendPublicKeyData?.publicKeyJwk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  // E2EE send helper
  const sendE2EE = useCallback(
    async (payload: {
      type: string;
      content?: string;
      url?: string;
      duration?: number;
      fileName?: string;
      mimeType?: string;
      size?: number;
    }) => {
      if (
        !selectedFriend?.userId ||
        !keyPair ||
        !friendPublicKeyData?.publicKeyJwk
      )
        return;
      const sharedKey = await getSharedKey(
        keyPair.privateKey,
        friendPublicKeyData.publicKeyJwk as JsonWebKey,
      );
      const { ciphertext, iv } = await encryptMessage(
        JSON.stringify(payload),
        sharedKey,
      );
      await sendMessageMutation.mutateAsync({
        data: { receiverId: selectedFriend.userId, ciphertext, iv },
      });
      refetchMessages();
    },
    [
      selectedFriend,
      keyPair,
      friendPublicKeyData,
      sendMessageMutation,
      refetchMessages,
    ],
  );

  const handleSendText = useCallback(async () => {
    if (!messageInput.trim()) return;
    try {
      await sendE2EE({ type: "text", content: messageInput.trim() });
      setMessageInput("");
      setShowEmojiDM(false);
    } catch (err) {
      console.error("Send error:", err);
    }
  }, [messageInput, sendE2EE]);

  // Attachment DM
  const handleDmAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDmImgUploading(true);
    try {
      const fd = new FormData();
      if (file.type.startsWith("image/")) {
        fd.append("image", file);
        const res = await apiFetch("social/upload-image", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Upload fallito");
        const { imageUrl } = await res.json();
        await sendE2EE({ type: "image", url: imageUrl });
      } else {
        fd.append("file", file);
        const res = await apiFetch("social/upload-file", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Upload fallito");
        const { fileUrl, fileName, mimeType, size } = await res.json();
        await sendE2EE({
          type: file.type.startsWith("video/") ? "video" : "file",
          url: fileUrl,
          fileName,
          mimeType,
          size,
        });
      }
    } catch (err) {
      reportClientError(err, {
        context: "DM attachment upload",
        fallbackMessage: "Upload file non riuscito.",
        toast,
      });
    } finally {
      setDmImgUploading(false);
      if (dmFileInputRef.current) dmFileInputRef.current.value = "";
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => recordChunksRef.current.push(e.data);
      mr.onstop = () => {
        setRecordedBlob(new Blob(recordChunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(
        () => setRecordDuration((d) => d + 1),
        1000,
      );
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
  };
  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordDuration(0);
  };

  const sendVoiceMessage = async () => {
    if (!recordedBlob) return;
    try {
      const fd = new FormData();
      fd.append("audio", recordedBlob, "voice.webm");
      const res = await apiFetch("social/upload-voice", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { audioUrl } = await res.json();
      await sendE2EE({
        type: "voice",
        url: audioUrl,
        duration: recordDuration,
      });
      setRecordedBlob(null);
      setRecordDuration(0);
    } catch (err) {
      console.error("Voice send error:", err);
    }
  };

  // Emoji DM
  const insertEmojiDM = (emoji: string) => {
    const el = msgInputRef.current;
    if (!el) {
      setMessageInput((m) => m + emoji);
      return;
    }
    const start = el.selectionStart ?? messageInput.length;
    const end = el.selectionEnd ?? messageInput.length;
    setMessageInput(
      messageInput.slice(0, start) + emoji + messageInput.slice(end),
    );
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
    setShowEmojiDM(false);
  };

  // ─── WebRTC Voice Call ────────────────────────────────────────────────────────
  const newCallId = () =>
    `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sendSignal = useCallback(
    async (to: string, type: string, data: string, cid: string) => {
      await apiFetch("social/calls/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, type, data, callId: cid }),
      });
    },
    [],
  );

  const cleanupCall = useCallback(() => {
    peerConnRef.current?.close();
    peerConnRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    setCallState("idle");
    setCallId(null);
    setCallPeer(null);
    setIsMuted(false);
    setPendingOffer(null);
  }, []);

  const startCall = async () => {
    if (!selectedFriend?.userId) return;
    const cid = newCallId();
    setCallId(cid);
    setCallPeer(selectedFriend);
    setCallState("calling");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate)
          await sendSignal(
            selectedFriend.userId!,
            "ice",
            JSON.stringify(e.candidate),
            cid,
          );
      };
      pc.ontrack = (e) => {
        const a = new Audio();
        remoteAudioRef.current = a;
        a.srcObject = e.streams[0];
        a.play().catch((error) =>
          reportClientError(error, {
            context: "direct call remote audio playback",
            notify: false,
          }),
        );
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(
        selectedFriend.userId!,
        "offer",
        JSON.stringify({ sdp: offer.sdp, type: offer.type }),
        cid,
      );
    } catch (err) {
      console.error("Call error:", err);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!pendingOffer) return;
    const { sdp: rawSdp, callId: cid, from } = pendingOffer;
    const peer =
      messageContacts.find((u) => u.userId === from) ??
      ({ userId: from, name: "Trader", avatarUrl: null } as SocialUser);
    setCallId(cid);
    setCallPeer(peer);
    setCallState("connected");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate)
          await sendSignal(from, "ice", JSON.stringify(e.candidate), cid);
      };
      pc.ontrack = (e) => {
        const a = new Audio();
        remoteAudioRef.current = a;
        a.srcObject = e.streams[0];
        a.play().catch((error) =>
          reportClientError(error, {
            context: "direct call remote audio playback",
            notify: false,
          }),
        );
      };
      const offerObj = JSON.parse(rawSdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offerObj));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(
        from,
        "answer",
        JSON.stringify({ sdp: answer.sdp, type: answer.type }),
        cid,
      );
      setPendingOffer(null);
    } catch (err) {
      console.error("Accept call error:", err);
      cleanupCall();
    }
  };

  const hangup = async () => {
    if (callPeer?.userId && callId) {
      try {
        await sendSignal(callPeer.userId, "hangup", "", callId);
      } catch (error) {
        reportClientError(error, {
          context: "direct call hangup signal",
          notify: false,
        });
      }
    }
    cleanupCall();
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((m) => !m);
  };

  // Poll for signals
  useEffect(() => {
    if (!e2eeReady) return;
    const poll = async () => {
      try {
        const data = await apiJSON<{ signals: CallSignal[] }>(
          "social/calls/signals",
        );
        for (const sig of data.signals ?? []) {
          const pc = peerConnRef.current;
          if (sig.type === "offer" && callState === "idle") {
            setPendingOffer({
              sdp: sig.data,
              callId: sig.callId,
              from: sig.from,
            });
            setCallState("incoming");
          } else if (
            sig.type === "answer" &&
            pc &&
            pc.signalingState === "have-local-offer"
          ) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(JSON.parse(sig.data)),
            );
            setCallState("connected");
          } else if (sig.type === "ice" && pc) {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(JSON.parse(sig.data)),
              );
            } catch (error) {
              reportClientError(error, {
                context: "direct call ICE candidate",
                notify: false,
              });
            }
          } else if (sig.type === "hangup") {
            cleanupCall();
          }
        }
      } catch (error) {
        reportClientError(error, {
          context: "direct call signal polling",
          notify: false,
        });
      }
    };
    const interval = setInterval(poll, callState !== "idle" ? 800 : 4000);
    return () => clearInterval(interval);
  }, [e2eeReady, callState, cleanupCall]);

  const handleSelect = (u: SocialUser) => {
    setSelectedFriend(u);
    setDecryptedMessages([]);
    setMobileView("chat");
  };

  // Render message bubble
  const renderBubble = (msg: DecryptedMsg) => {
    const isMine = msg.senderId !== selectedFriend?.userId;
    const base = `max-w-[78%] rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card/80 border border-border rounded-bl-md"}`;
    const timeEl = (
      <p
        className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}
      >
        {new Date(msg.createdAt).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    );
    if (msg.type === "image")
      return (
        <div className={`${base} overflow-hidden p-0`}>
          <img
            src={msg.content}
            alt="img"
            className="max-w-[240px] max-h-44 w-full object-cover"
          />
          <div className="px-3 py-1.5">{timeEl}</div>
        </div>
      );
    if (msg.type === "voice")
      return (
        <div className={`${base} min-w-[260px] px-3 py-2.5`}>
          <audio
            aria-label="Messaggio vocale"
            controls
            src={msg.content}
            className="h-9 w-full"
            style={{ accentColor: "currentColor" }}
          />
          {timeEl}
        </div>
      );
    if (msg.type === "video")
      return (
        <div className={`${base} overflow-hidden p-0 min-w-[260px]`}>
          {msg.fileName && (
            <p className="px-3 pt-2 text-xs font-medium truncate">
              {msg.fileName}
            </p>
          )}
          <video
            aria-label={msg.fileName ?? "Video allegato"}
            controls
            src={msg.content}
            className="max-w-[320px] max-h-64 w-full bg-black"
          />
          <div className="px-3 py-1.5">{timeEl}</div>
        </div>
      );
    if (msg.type === "file")
      return (
        <div className={`${base} min-w-[260px] px-3 py-2.5`}>
          <div className="flex items-center gap-3">
            {fileIcon(msg.mimeType ?? "")}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {msg.fileName ?? "File allegato"}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {(msg.mimeType || "file").split(";")[0]}
                {typeof msg.size === "number" ? ` · ${formatFileSize(msg.size)}` : ""}
              </p>
            </div>
            <a
              href={msg.content}
              target="_blank"
              rel="noreferrer"
              download={msg.fileName}
              className="p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
              title="Apri o scarica"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
          {timeEl}
        </div>
      );
    return (
      <div className={`${base} px-4 py-2.5`}>
        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
        {timeEl}
      </div>
    );
  };

  // Call overlay
  const callOverlay = callState !== "idle" && (
    <div className="absolute inset-0 z-30 bg-black/92 backdrop-blur-sm flex items-center justify-center rounded-inherit">
      <div className="text-center space-y-5 px-6">
        {callPeer && (
          <div className="mx-auto">
            <Avatar
              name={callPeer.name}
              avatarUrl={callPeer.avatarUrl}
              size="lg"
              ring="ring-primary ring-4"
            />
          </div>
        )}
        <div>
          <p className="text-white font-semibold text-lg">
            {callPeer?.name ?? "Chiamata..."}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {callState === "calling"
              ? "In chiamata..."
              : callState === "incoming"
                ? "Chiamata in arrivo"
                : "● Connesso"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-5">
          {callState === "incoming" && (
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-400 transition-colors shadow-lg shadow-green-500/30"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          )}
          {callState === "connected" && (
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"}`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>
          )}
          <button
            onClick={hangup}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );

  if (e2eeError)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-destructive opacity-40" />
          <p className="text-muted-foreground text-sm">Errore crittografia</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm"
          >
            Riprova
          </button>
        </div>
      </div>
    );

  if (!e2eeReady)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            Inizializzazione crittografia...
          </p>
        </div>
      </div>
    );

  const list = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Messaggi E2EE</p>
        </div>
        <div className="flex items-center gap-2">
          {callState === "incoming" && (
            <button
              onClick={() => setCallState("incoming")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium animate-pulse"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Chiamata
            </button>
          )}
          {(unreadData as any)?.count > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full font-bold">
              {(unreadData as any).count}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading || friendsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messageContacts.length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground space-y-3">
            <UserCheck className="w-12 h-12 mx-auto opacity-20" />
            <p className="font-medium text-sm">Nessun contatto disponibile</p>
            <p className="text-xs leading-relaxed">
              Seguiti e seguaci possono chattare. Vai nel tab Social per trovare
              altri trader!
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {messageContacts.map((u) => (
              <div
                key={u.userId}
                onClick={() => handleSelect(u)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedFriend?.userId === u.userId ? "bg-primary/10 border border-primary/30" : "hover:bg-white/5 border border-transparent"}`}
              >
                <Avatar name={u.name} avatarUrl={u.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-primary flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> {u.isMutual ? "Mutual" : "Amico"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const chatArea = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
      {callOverlay}
      {selectedFriend ? (
        <>
          <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setSelectedFriend(null);
                setMobileView("list");
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar
              name={selectedFriend.name}
              avatarUrl={selectedFriend.avatarUrl}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {selectedFriend.name}
              </p>
              <p className="text-xs text-primary flex items-center gap-1">
                <Shield className="w-3 h-3" /> E2EE
              </p>
            </div>
            {callState === "idle" && (
              <button
                onClick={startCall}
                title="Chiamata vocale"
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            {callState === "incoming" && (
              <button
                onClick={acceptCall}
                className="p-2 rounded-lg bg-green-500/20 text-green-400 animate-pulse"
              >
                <PhoneCall className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {decryptedMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Inizio conversazione cifrata</p>
              </div>
            ) : (
              decryptedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId !== selectedFriend.userId ? "justify-end" : "justify-start"}`}
                >
                  {renderBubble(msg)}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {showEmojiDM && (
            <div className="border-t border-border bg-card/50 p-3 shrink-0">
              <EmojiPickerPanel onSelect={insertEmojiDM} />
            </div>
          )}

          {(isRecording || recordedBlob) && (
            <div className="border-t border-border bg-card/50 px-4 py-3 flex items-center gap-3 shrink-0">
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono text-red-400">
                      {fmtDur(recordDuration)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Registrazione in corso...
                    </span>
                  </div>
                  <button
                    onClick={cancelRecording}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs flex items-center gap-1.5"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop
                  </button>
                </>
              ) : (
                <>
                  <audio
                    controls
                    src={URL.createObjectURL(recordedBlob!)}
                    className="flex-1 h-8"
                  />
                  <button
                    onClick={cancelRecording}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={sendVoiceMessage}
                    className="p-2 bg-primary text-primary-foreground rounded-lg"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="p-3 border-t border-border shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEmojiDM((s) => !s)}
                title="Emoji"
                className={`p-2 rounded-lg transition-colors ${showEmojiDM ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                onClick={() => dmFileInputRef.current?.click()}
                disabled={dmImgUploading}
                title="Allega file"
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              >
                {dmImgUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!!recordedBlob}
                title={isRecording ? "Ferma registrazione" : "Registra vocale"}
                className={`p-2 rounded-lg transition-colors ${isRecording ? "text-red-400 bg-red-500/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"} disabled:opacity-40`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                ref={msgInputRef}
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSendText()
                }
                placeholder="Messaggio cifrato..."
                className="flex-1 px-3 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                disabled={isRecording || !!recordedBlob}
              />
              <button
                onClick={handleSendText}
                disabled={
                  !messageInput.trim() ||
                  sendMessageMutation.isPending ||
                  isRecording ||
                  !!recordedBlob
                }
                className="px-3 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={dmFileInputRef}
              type="file"
              accept="*"
              className="hidden"
              onChange={handleDmAttachment}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground space-y-3">
            <Lock className="w-16 h-16 mx-auto opacity-20" />
            <p className="text-sm">Seleziona un contatto</p>
            <p className="text-xs">Solo i mutual follow possono chattare</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <div className="hidden lg:grid grid-cols-[280px_1fr] h-full min-h-0">
        <div className="border-r border-border">{list}</div>
        <div className="relative min-h-0 overflow-hidden">{chatArea}</div>
      </div>
      <div className="lg:hidden h-full min-h-0 relative overflow-hidden">
        {mobileView === "list" ? list : chatArea}
      </div>
    </div>
  );
}

// ─── CLASSIFICA TAB ───────────────────────────────────────────────────────────

function ClassificaTab() {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: profile } = useGetProfile();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <div>
          <p className="font-semibold text-sm">Classifica Trader</p>
          <p className="text-xs text-muted-foreground">
            Ranking per XP e livello
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun trader in classifica.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {leaderboard.map((entry, idx) => {
              const isMe = profile && entry.name === profile.name;
              return (
                <motion.div
                  key={entry.position}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`px-4 py-3 flex items-center gap-3 transition-colors hover:bg-secondary/20 ${isMe ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                >
                  <PositionBadge position={entry.position} />
                  <div className="w-9 h-9 rounded-full border border-border/50 overflow-hidden bg-secondary flex-shrink-0">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${isMe ? "text-primary" : ""}`}
                    >
                      {entry.name}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] text-primary/70">
                          (tu)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Livello {entry.level}
                    </p>
                  </div>
                  <div className="bg-secondary/80 border border-border px-2 py-0.5 rounded-md">
                    <span className="text-xs font-bold font-mono text-accent">
                      {entry.xp.toLocaleString()} XP
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Community Types ──────────────────────────────────────────────────────────

interface CommunityType {
  id: number;
  name: string;
  description: string;
  iconEmoji: string;
  memberCount: number;
  isMember: boolean;
  creatorId: string;
  isPublic: boolean;
  createdAt: string;
}

interface ChannelType {
  id: number;
  communityId: number;
  name: string;
  type: "text" | "voice";
  position: number;
}

interface CommunityDetail extends CommunityType {
  channels: ChannelType[];
  myRole: string | null;
}

interface CommunityMsg {
  id: number;
  channelId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

interface VoiceParticipant {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}

// ─── Community Hooks ──────────────────────────────────────────────────────────

function useCommunities() {
  return useQuery<CommunityType[]>({
    queryKey: ["communities"],
    queryFn: () => apiJSON("community"),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

function useCommunityDetail(id: number | null) {
  return useQuery<CommunityDetail>({
    queryKey: ["community", id],
    queryFn: () => apiJSON(`community/${id}`),
    enabled: id !== null,
    staleTime: 10_000,
  });
}

function useCommunityMessages(channelId: number | null) {
  return useQuery<{ messages: CommunityMsg[]; nextCursor: number | null }>({
    queryKey: ["communityMessages", channelId],
    queryFn: () => apiJSON(`community/channels/${channelId}/messages`),
    enabled: channelId !== null,
    refetchInterval: 3_000,
    staleTime: 0,
  });
}

function useVoicePresence(channelId: number | null, enabled: boolean) {
  return useQuery<VoiceParticipant[]>({
    queryKey: ["voicePresence", channelId],
    queryFn: () => apiJSON(`community/voice/${channelId}/presence`),
    enabled: channelId !== null && enabled,
    refetchInterval: 5_000,
    staleTime: 0,
  });
}

// ─── Create Community Modal ───────────────────────────────────────────────────

const COMMUNITY_EMOJIS = [
  "🏛️",
  "📊",
  "💹",
  "🎯",
  "🧠",
  "⚡",
  "🔥",
  "🚀",
  "💎",
  "🌐",
  "📈",
  "🏆",
  "🤝",
  "🛡️",
  "⚙️",
];

function CreateCommunityModal({
  onClose,
  currentUserId,
}: {
  onClose: () => void;
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🏛️");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Il nome è obbligatorio");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiJSON("community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          iconEmoji: emoji,
        }),
      });
      qc.invalidateQueries({ queryKey: ["communities"] });
      onClose();
    } catch {
      setError("Errore durante la creazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">Crea Community</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Icona
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border ${emoji === e ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/40"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Nome *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="es. Trader SMC Italia"
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Descrizione
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Di cosa parla questa community?"
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {loading ? "Creazione..." : "Crea Community"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Create Channel Modal ─────────────────────────────────────────────────────

function CreateChannelModal({
  communityId,
  onClose,
}: {
  communityId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await apiJSON(`community/${communityId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      qc.invalidateQueries({ queryKey: ["community", communityId] });
      onClose();
    } catch (error) {
      reportClientError(error, {
        context: "community channel create",
        notify: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">Nuovo canale</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["text", "voice"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                {t === "text" ? (
                  <Hash className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
                <span className="text-xs font-semibold">
                  {t === "text" ? "Testo" : "Voce"}
                </span>
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={
              type === "text" ? "es. analisi-tecnica" : "es. Sala Vocale"
            }
            className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creazione..." : "Crea canale"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Text Channel View ────────────────────────────────────────────────────────

function TextChannelView({
  channel,
  currentUserId,
  isOwnerOrAdmin,
}: {
  channel: ChannelType;
  currentUserId: string;
  isOwnerOrAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useCommunityMessages(channel.id);
  const { data: files = [] } = useCommunityFiles(channel.id);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMsg = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);
    try {
      await apiJSON(`community/channels/${channel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      qc.invalidateQueries({ queryKey: ["communityMessages", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community message send",
        notify: false,
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiFetch(`community/channels/${channel.id}/files`, {
        method: "POST",
        body: fd,
      });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
      setActiveTab("files");
    } catch (error) {
      reportClientError(error, {
        context: "community file upload",
        notify: false,
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleDownloadable = async (fileId: number, current: boolean) => {
    try {
      await apiJSON(`community/files/${fileId}/downloadable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadable: !current }),
      });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community file downloadable toggle",
        notify: false,
      });
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await apiFetch(`community/files/${fileId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community file delete",
        notify: false,
      });
    }
  };

  const groupedMessages = messages.reduce<
    { date: string; msgs: CommunityMsg[] }[]
  >((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
    });
    const last = acc[acc.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else acc.push({ date, msgs: [msg] });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-0 px-4 border-b border-border shrink-0 bg-card/30">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Hash className="w-3.5 h-3.5" /> {channel.name}
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === "files" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          File
          {files.length > 0 && (
            <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px]">
              {files.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "chat" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                <Hash className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">Nessun messaggio ancora</p>
                <p className="text-xs mt-1">
                  Sii il primo a scrivere in #{channel.name}!
                </p>
              </div>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                      {group.date}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  <div className="space-y-1">
                    {group.msgs.map((msg, i) => {
                      const prev = group.msgs[i - 1];
                      const isGrouped =
                        prev?.userId === msg.userId &&
                        new Date(msg.createdAt).getTime() -
                          new Date(prev.createdAt).getTime() <
                          300_000;
                      const isMe = msg.userId === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2.5 ${isGrouped ? "ml-9" : ""}`}
                        >
                          {!isGrouped && (
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden shrink-0 mt-0.5">
                              {msg.avatarUrl ? (
                                <img
                                  src={msg.avatarUrl}
                                  alt={msg.userName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                  {msg.userName[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {!isGrouped && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span
                                  className={`text-xs font-semibold ${isMe ? "text-primary" : ""}`}
                                >
                                  {msg.userName}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">
                                  {new Date(msg.createdAt).toLocaleTimeString(
                                    "it-IT",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                            )}
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt=""
                                className="max-w-xs rounded-xl mb-1 border border-border"
                              />
                            )}
                            {msg.content && (
                              <p className="text-sm leading-relaxed break-words text-foreground/90">
                                {msg.content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-border bg-card/20">
            <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-xl px-3 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Allega file"
                className="text-muted-foreground hover:text-primary transition-colors shrink-0 disabled:opacity-40"
              >
                {uploadingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), sendMsg())
                }
                placeholder={`Messaggio in #${channel.name}`}
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
              />
              <button
                onClick={sendMsg}
                disabled={!text.trim() || sending}
                className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 text-primary flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <FolderOpen className="w-12 h-12 opacity-20 mb-3" />
              <p className="text-sm font-medium">Nessun file caricato</p>
              <p className="text-xs mt-1">
                Usa l'icona 📎 nella chat per caricare file
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {isOwnerOrAdmin && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-secondary/20 mb-3">
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Come owner/admin puoi controllare se ogni file è scaricabile
                    dai membri.
                  </p>
                </div>
              )}
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/40 group"
                >
                  <div className="shrink-0">{fileIcon(f.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {f.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(f.fileSize)} · {f.userName} ·{" "}
                      {new Date(f.createdAt).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => toggleDownloadable(f.id, f.downloadable)}
                        title={
                          f.downloadable
                            ? "Scaricabile — clicca per bloccare"
                            : "Non scaricabile — clicca per abilitare"
                        }
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${f.downloadable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}
                      >
                        {f.downloadable ? (
                          <ToggleRight className="w-3.5 h-3.5" />
                        ) : (
                          <ToggleLeft className="w-3.5 h-3.5" />
                        )}
                        {f.downloadable ? "DL" : "NO"}
                      </button>
                    )}
                    {f.downloadable ? (
                      <a
                        href={f.fileUrl}
                        download={f.fileName}
                        className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
                        title="Scarica"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg bg-secondary/30 text-muted-foreground/30 flex items-center justify-center"
                        title="Download disabilitato"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {(f.userId === currentUserId || isOwnerOrAdmin) && (
                      <button
                        onClick={() => deleteFile(f.id)}
                        className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Voice Channel View ───────────────────────────────────────────────────────

function VoiceChannelView({
  channel,
  currentUserId,
  currentUserName,
}: {
  channel: ChannelType;
  currentUserId: string;
  currentUserName: string;
}) {
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { data: participants = [] } = useVoicePresence(channel.id, true);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const createPeer = useCallback(
    (peerId: string, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnsRef.current[peerId] = pc;
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((t) => pc.addTrack(t, streamRef.current!));
      }
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await apiFetch(`community/voice/${channel.id}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: peerId,
              type: "ice",
              data: JSON.stringify(e.candidate),
            }),
          });
        }
      };
      pc.ontrack = (e) => {
        let audio = audioRefs.current[peerId];
        if (!audio) {
          audio = new Audio();
          audioRefs.current[peerId] = audio;
          audio.autoplay = true;
        }
        audio.srcObject = e.streams[0];
      };
      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          apiFetch(`community/voice/${channel.id}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: peerId,
              type: "offer",
              data: JSON.stringify(offer),
            }),
          });
        });
      }
      return pc;
    },
    [channel.id],
  );

  const joinChannel = async () => {
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      await apiJSON(`community/voice/${channel.id}/join`, { method: "POST" });
      setInChannel(true);
      pingIntervalRef.current = setInterval(async () => {
        await apiFetch(`community/voice/${channel.id}/ping`, {
          method: "POST",
        });
      }, 8_000);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const { signals } = await apiJSON<{ signals: VoiceSignal[] }>(
            `community/voice/${channel.id}/signals`,
          );
          for (const sig of signals ?? []) {
            let pc = peerConnsRef.current[sig.from];
            if (sig.type === "offer") {
              if (!pc) pc = createPeer(sig.from, false);
              await pc.setRemoteDescription(
                new RTCSessionDescription(JSON.parse(sig.data)),
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await apiFetch(`community/voice/${channel.id}/signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: sig.from,
                  type: "answer",
                  data: JSON.stringify(answer),
                }),
              });
            } else if (sig.type === "answer" && pc) {
              await pc.setRemoteDescription(
                new RTCSessionDescription(JSON.parse(sig.data)),
              );
            } else if (sig.type === "ice" && pc) {
              try {
                await pc.addIceCandidate(
                  new RTCIceCandidate(JSON.parse(sig.data)),
                );
              } catch (error) {
                reportClientError(error, {
                  context: "community voice ICE candidate",
                  notify: false,
                });
              }
            }
          }
        } catch (error) {
          reportClientError(error, {
            context: "community voice signal polling",
            notify: false,
          });
        }
      }, 2_000);
    } catch (err) {
      console.error("Voice join error:", err);
    } finally {
      setConnecting(false);
    }
  };

  const leaveChannel = useCallback(async () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    Object.values(peerConnsRef.current).forEach((pc) => pc.close());
    peerConnsRef.current = {};
    Object.values(audioRefs.current).forEach((a) => {
      a.pause();
      a.srcObject = null;
    });
    audioRefs.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      await apiFetch(`community/voice/${channel.id}/leave`, {
        method: "DELETE",
      });
    } catch (error) {
      reportClientError(error, {
        context: "community voice leave",
        notify: false,
      });
    }
    setInChannel(false);
    setIsMuted(false);
  }, [channel.id]);

  useEffect(() => {
    if (!inChannel) return;
    const prevParticipants = participants.filter(
      (p) => p.userId !== currentUserId,
    );
    prevParticipants.forEach((p) => {
      if (!peerConnsRef.current[p.userId]) createPeer(p.userId, true);
    });
  }, [participants, inChannel, currentUserId, createPeer]);

  useEffect(
    () => () => {
      if (inChannel) leaveChannel();
    },
    [],
  );

  const toggleMute = () => {
    if (!streamRef.current) return;
    const enabled = !isMuted;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setIsMuted(!enabled);
  };

  const others = participants.filter((p) => p.userId !== currentUserId);
  const meInChannel = participants.some((p) => p.userId === currentUserId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">{channel.name}</span>
        {participants.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 border border-border px-2 py-0.5 rounded-full">
            {participants.length} connessi
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-6">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${inChannel ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20" : "bg-secondary/40 border-2 border-border"}`}
          >
            <Headphones
              className={`w-10 h-10 ${inChannel ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>

          {!inChannel ? (
            <div className="text-center space-y-3">
              <p className="font-semibold text-base">{channel.name}</p>
              <p className="text-sm text-muted-foreground">
                {participants.length === 0
                  ? "Nessuno ancora in questo canale"
                  : `${participants.length} trader ${participants.length === 1 ? "connesso" : "connessi"}`}
              </p>
              <button
                onClick={joinChannel}
                disabled={connecting}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-lg shadow-primary/20"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                {connecting ? "Connessione..." : "Entra nel canale"}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div>
                <p className="font-semibold text-base text-primary">
                  Connesso in {channel.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isMuted ? "Microfono disattivato" : "Microfono attivo"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors border ${isMuted ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-secondary/60 border-border text-foreground hover:bg-secondary"}`}
                >
                  {isMuted ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={leaveChannel}
                  className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg shadow-red-500/20"
                >
                  <PhoneOff className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In ascolto
            </p>
            <div className="space-y-1.5">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${p.userId === currentUserId ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden shrink-0">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                          {p.userName[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                  </div>
                  <span
                    className={`text-sm font-medium ${p.userId === currentUserId ? "text-primary" : ""}`}
                  >
                    {p.userName}
                    {p.userId === currentUserId && " (tu)"}
                  </span>
                  {p.userId !== currentUserId && (
                    <Headphones className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Community Tab ────────────────────────────────────────────────────────────

function CommunityTab({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const qc = useQueryClient();
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
  const [mobilePanel, setMobilePanel] = useState<
    "communities" | "channels" | "content"
  >("communities");

  const selectedChannel =
    communityDetail?.channels.find((c) => c.id === selectedChannelId) ?? null;
  const isOwnerOrAdmin =
    communityDetail?.myRole === "owner" || communityDetail?.myRole === "admin";

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
    setMobilePanel("channels");
  };

  const selectChannel = (id: number) => {
    setSelectedChannelId(id);
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
          <span className="font-bold text-sm">Comunità</span>
        </div>
        <button
          onClick={() => setShowCreateCommunity(true)}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Crea community"
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
                    <span className="text-xl leading-none shrink-0">
                      {c.iconEmoji}
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
                    <span className="text-xl leading-none shrink-0 opacity-70">
                      {c.iconEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-[10px]">{c.memberCount} membri</p>
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
          <div className="flex items-center gap-1.5 mb-1">
            <button
              onClick={() => setMobilePanel("communities")}
              className="lg:hidden p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xl">{communityDetail.iconEmoji}</span>
            <p className="font-bold text-sm truncate">{communityDetail.name}</p>
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
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {(["text", "voice"] as const).map((type) => {
            const channels = communityDetail.channels.filter(
              (c) => c.type === type,
            );
            if (channels.length === 0 && !isOwnerOrAdmin) return null;
            return (
              <div key={type} className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {type === "text" ? "Testo" : "Voce"}
                  </p>
                  {isOwnerOrAdmin && (
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
          <p className="text-sm font-medium">Seleziona una community</p>
          <p className="text-xs mt-1">o creane una nuova con il pulsante +</p>
        </div>
      </div>
    );

  const contentArea =
    selectedChannel && communityDetail?.isMember ? (
      selectedChannel.type === "text" ? (
        <TextChannelView
          channel={selectedChannel}
          currentUserId={currentUserId}
          isOwnerOrAdmin={isOwnerOrAdmin}
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
              <p className="text-sm font-medium">Seleziona una community</p>
              <p className="text-xs mt-1">
                Unisciti o creane una nuova per iniziare
              </p>
            </>
          ) : !communityDetail?.isMember ? (
            <>
              <UserPlus className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium">{communityDetail?.name}</p>
              <p className="text-xs mt-1 mb-4">
                {communityDetail?.memberCount} membri
              </p>
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
              <p className="text-sm font-medium">Seleziona un canale</p>
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
    </>
  );
}

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
          {activeTab === "classifica" && <ClassificaTab />}
        </div>
      </motion.section>
    </PageLayout>
  );
}
