import { useState } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { useGetProfile } from "@workspace/api-client-react";
import { Loader2, Trophy } from "lucide-react";
import { Avatar } from "./Avatar";
import { PositionBadge } from "./PositionBadge";
import { useLeaderboard } from "./hooks";
import { UserProfileModal } from "./UserProfileModal";

export function ClassificaTab({ currentUserId }: { currentUserId: string }) {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: profile } = useGetProfile();
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <div>
            <p className="font-semibold text-sm">{uiText("chat.leaderboard.title")}</p>
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
              <p className="text-sm">{uiText("auto.ui.5ce296ad34")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {leaderboard.map((entry, idx) => {
                const isMe = entry.userId === currentUserId || Boolean(profile && entry.name === profile.name);
                const canViewProfile = Boolean(entry.userId && entry.userId !== currentUserId);
                return (
                  <motion.div
                    key={`${entry.position}-${entry.userId ?? entry.name}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => canViewProfile && entry.userId && setViewingProfile(entry.userId)}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                      isMe ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    } ${canViewProfile ? "cursor-pointer hover:bg-secondary/20 active:bg-secondary/40" : ""}`}
                  >
                    <PositionBadge position={entry.position} />
                    <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${isMe ? "text-primary" : canViewProfile ? "group-hover:text-primary" : ""}`}
                      >
                        {entry.name}
                        {isMe && (
                          <span className="ml-1.5 text-[10px] text-primary/70">{uiText("auto.ui.7f73d79689")}</span>
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
      {viewingProfile && (
        <UserProfileModal
          userId={viewingProfile}
          currentUserId={currentUserId}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </>
  );
}
