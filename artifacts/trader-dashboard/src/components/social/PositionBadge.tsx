import { Crown, Medal, Award } from "lucide-react";

export function PositionBadge({ position }: { position: number }) {
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
