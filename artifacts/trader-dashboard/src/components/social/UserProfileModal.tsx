import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  X,
  UserMinus,
  UserPlus,
  Lock,
  UserCheck,
  Heart,
} from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { Avatar } from "./Avatar";
import { useUserProfile } from "./hooks";
import type { SocialUser, Post } from "./types";

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
              <p className="text-xs text-muted-foreground">{uiText("auto.ui.995174eedf")}</p>
            </div>
            <div>
              <p className="font-bold">{followingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{uiText("auto.ui.90eeb10083")}</p>
            </div>
            <div>
              <p className="font-bold">{posts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">{uiText("auto.ui.7858ac3ff6")}</p>
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
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{uiText("auto.ui.7858ac3ff6")}</p>
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
