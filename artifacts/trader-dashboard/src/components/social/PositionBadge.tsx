import { Crown, Medal, Award } from "lucide-react";

export function PositionBadge({ position }: { position: number }) {
  if (position === 1)
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-[#997A35]/20 border border-[#D4AF37] flex items-center justify-center text-[#FFDF88] shadow-[0_0_12px_rgba(212,175,55,0.4)]">
        <Crown className="w-4 h-4 text-[#FFDF88]" />
      </div>
    );
  if (position === 2)
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-slate-400/10 border border-slate-300 flex items-center justify-center text-white shadow-[0_0_8px_rgba(255,255,255,0.2)]">
        <Medal className="w-4 h-4 text-slate-200" />
      </div>
    );
  if (position === 3)
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CD7F32]/25 to-[#8B4513]/15 border border-[#CD7F32]/80 flex items-center justify-center text-[#E69A58] shadow-[0_0_8px_rgba(205,127,50,0.25)]">
        <Award className="w-4 h-4 text-[#E69A58]" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-[#12131A] border border-[#C5A059]/25 flex items-center justify-center">
      <span className="text-xs font-bold font-mono text-slate-400">
        #{position}
      </span>
    </div>
  );
}
