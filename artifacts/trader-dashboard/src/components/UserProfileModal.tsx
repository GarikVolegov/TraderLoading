import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, UserMinus, UserCheck, Heart, Lock, Loader2, User } from "lucide-react";

interface SocialUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

interface Post {
  id: number;
  content: string;
  imageUrl: string | null;
  likesCount: number;
  createdAt: string;
}

interface ProfileData {
  profile: { name: string; avatarUrl?: string | null; level: number; xp: number } | null;
  posts: Post[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isMutual: boolean;
  isOwnProfile: boolean;
}

function apiJSON(path: string, opts?: RequestInit) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const url = `${base}${path}`.replace(/\/+/g, "/");
  return fetch(url, { credentials: "include", ...opts }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "poco fa";
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-xl" }[size];
  return (
    <div className={`${sz} rounded-full border border-border/50 overflow-hidden bg-secondary flex-shrink-0`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function UserProfileModal({
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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["social/profile", userId],
    queryFn: () => apiJSON(`api/social/profile/${userId}`),
    enabled: !!userId,
  });

  const follow = useMutation({
    mutationFn: () => apiJSON(`api/social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
      qc.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
  });
  const unfollow = useMutation({
    mutationFn: () => apiJSON(`api/social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/profile", userId] });
      qc.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="bg-card rounded-2xl p-8" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const { profile, posts = [], followersCount = 0, followingCount = 0, isFollowing, isMutual, isOwnProfile } = data ?? {};

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
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={profile?.name ?? "?"} avatarUrl={profile?.avatarUrl} size="lg" />
              <div>
                <p className="font-bold text-lg leading-tight">{profile?.name ?? "Trader"}</p>
                <p className="text-xs text-muted-foreground">
                  Livello {profile?.level ?? 1} · {(profile?.xp ?? 0).toLocaleString()} XP
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

          <div className="flex gap-6 text-center">
            <div>
              <p className="font-bold text-lg">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Follower</p>
            </div>
            <div>
              <p className="font-bold text-lg">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div>
              <p className="font-bold text-lg">{posts.length}</p>
              <p className="text-xs text-muted-foreground">Post</p>
            </div>
          </div>

          {!isOwnProfile && (
            <div className="flex gap-2">
              {isFollowing ? (
                <button
                  onClick={() => unfollow.mutate()}
                  disabled={unfollow.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                >
                  <UserMinus className="w-4 h-4" /> Smetti di seguire
                </button>
              ) : (
                <button
                  onClick={() => follow.mutate()}
                  disabled={follow.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" /> Segui
                </button>
              )}
              {isMutual && onStartChat && profile && (
                <button
                  onClick={() => {
                    onStartChat({ userId, name: profile.name ?? "Trader", avatarUrl: profile.avatarUrl ?? null });
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
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
              <UserCheck className="w-3.5 h-3.5" /> Si seguono a vicenda · Chat disponibile
            </div>
          )}

          {posts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Post recenti</p>
              <div className="space-y-2">
                {posts.slice(0, 5).map((p) => (
                  <div key={p.id} className="bg-secondary/30 rounded-xl p-3 text-sm">
                    <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3">{p.content}</p>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="post" className="mt-2 w-full rounded-lg object-cover max-h-40" />
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {p.likesCount}
                      </span>
                      <span>{timeAgo(p.createdAt)}</span>
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
