import { Lock, Library, Zap, Star } from "lucide-react";
import { getUnlockedRewards, getNextMilestone, getMilestoneProgress, MILESTONES, REWARDS } from "@/lib/rewardsLibrary";
import { RewardCard } from "@/components/LevelRewardModal";
import { uiText } from "@/contexts/LanguageContext";
import { useGetProfile } from "@workspace/api-client-react";

export function RewardsLibrarySection() {
  const { data: profile } = useGetProfile();
  const level = profile?.level ?? 0;
  const unlocked = getUnlockedRewards(level);
  const nextMilestone = getNextMilestone(level);
  const progress = getMilestoneProgress(level);

  const unlockedMilestones = MILESTONES.filter((m) => level >= m);
  const lockedMilestones = MILESTONES.filter((m) => level < m);

  return (
    <div className="space-y-6">
      {/* Progress bar to next milestone */}
      <div className="bg-secondary/30 rounded-xl p-4 border border-border/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Livello {level}</span>
          </div>
          {nextMilestone ? (
            <span className="text-xs text-muted-foreground">
              Prossimo sblocco al livello{" "}
              <span className="text-primary font-bold">{nextMilestone}</span>
            </span>
          ) : (
            <span className="text-xs text-primary font-semibold">{uiText("auto.ui.195e8d38db")}</span>
          )}
        </div>
        {nextMilestone && (
          <>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {level} / {nextMilestone} livelli — ancora {nextMilestone - level}{" "}
              livello{nextMilestone - level !== 1 ? "i" : ""} per sbloccare
              nuovi contenuti
            </p>
          </>
        )}
      </div>

      {/* Unlocked content */}
      {unlockedMilestones.length > 0 && (
        <div className="space-y-5">
          {unlockedMilestones.map((m) => {
            const mRewards = REWARDS.filter((r) => r.milestone === m);
            return (
              <div key={m}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 border border-primary/30 rounded-full">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-primary">
                      Livello {m}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mRewards.map((r) => (
                    <RewardCard key={r.id} reward={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Locked milestones */}
      {lockedMilestones.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.cdb9f9ede9")}</p>
          {lockedMilestones.map((m) => {
            const count = REWARDS.filter((r) => r.milestone === m).length;
            return (
              <div
                key={m}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-secondary/20 opacity-60"
              >
                <div className="w-10 h-10 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {count} contenuto{count !== 1 ? "i" : ""} al livello {m}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Raggiungi il livello {m} per sbloccarli
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <span className="text-[11px] text-muted-foreground/70 font-mono">
                    Lvl {m}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {unlocked.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{uiText("settings.library.level_5")}</p>
          <p className="text-xs mt-1">
            Il tuo primo contenuto si sbloccherà al livello 5
          </p>
        </div>
      )}
    </div>
  );
}
