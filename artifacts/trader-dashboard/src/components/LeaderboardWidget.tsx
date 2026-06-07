import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown, Medal, Award, User } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGetProfile } from "@workspace/api-client-react";
import { UserProfileModal } from "@/components/UserProfileModal";

interface LeaderboardEntry {
  position: number;
  userId?: string | null;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
}

function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch("api/leaderboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_12px_rgba(234,179,8,0.3)]">
        <Crown className="w-4 h-4 text-yellow-400" />
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-300/20 border border-slate-400/50 flex items-center justify-center">
        <Medal className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600/50 flex items-center justify-center">
        <Award className="w-4 h-4 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-secondary/50 border border-border flex items-center justify-center">
      <span className="text-xs font-bold font-mono text-muted-foreground">#{position}</span>
    </div>
  );
}

export function LeaderboardWidget() {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: profile } = useGetProfile();
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const currentUserId = (profile as any)?.userId ?? "";

  return (
    <>
      <Card className="h-full relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 border-b border-border/50 bg-secondary/10">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            Classifica Trader
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-medium">
              Nessun trader in classifica.
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
              {leaderboard.map((entry, idx) => {
                const isCurrentUser = profile && entry.name === profile.name && entry.xp === profile.xp;
                const canClick = !!entry.userId && !isCurrentUser;
                return (
                  <motion.div
                    key={`${entry.position}-${entry.name}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => canClick && entry.userId && setViewingUserId(entry.userId)}
                    className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 transition-colors ${
                      isCurrentUser ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    } ${canClick ? "cursor-pointer hover:bg-secondary/30 active:bg-secondary/50" : ""}`}
                  >
                    <PositionBadge position={entry.position} />

                    <div className="w-9 h-9 rounded-full border border-border/50 overflow-hidden bg-secondary flex-shrink-0">
                      {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isCurrentUser ? "text-primary" : canClick ? "hover:text-primary transition-colors" : "text-foreground"}`}>
                        {entry.name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-[10px] font-medium text-primary/70">(tu)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Livello {entry.level}</p>
                    </div>

                    <div className="flex items-center gap-1 bg-secondary/80 border border-border px-2 py-0.5 rounded-md">
                      <span className="text-xs font-bold font-mono text-accent">
                        {entry.xp.toLocaleString()} XP
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          currentUserId={currentUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </>
  );
}
