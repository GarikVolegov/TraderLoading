import { useVoicePresence } from "./hooks";

export function VoiceChannelPresenceBadge({ channelId }: { channelId: number }) {
  const { data: participants = [] } = useVoicePresence(channelId, true);
  if (!participants || participants.length === 0) return null;

  return (
    <span
      className="ml-auto inline-flex items-center gap-1 rounded bg-[#10B981]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#10B981] whitespace-nowrap border border-[#10B981]/30 shadow-sm"
      title={`${participants.length} ${participants.length === 1 ? "Operatore connesso" : "Operatori connessi"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
      <span>{participants.length}</span>
    </span>
  );
}
