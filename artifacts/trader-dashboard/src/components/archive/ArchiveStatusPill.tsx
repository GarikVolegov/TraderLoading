import { AlertCircle, CheckCircle2, Loader2, Volume2 } from "lucide-react";
import type { WikiStatus } from "@/lib/archive";

const META: Record<WikiStatus, { color: string; spin: boolean; Icon: typeof AlertCircle }> = {
  queued: { color: "text-sky-300", spin: true, Icon: Loader2 },
  processing: { color: "text-amber-300", spin: true, Icon: Loader2 },
  ready: { color: "text-emerald-300", spin: false, Icon: CheckCircle2 },
  error: { color: "text-red-300", spin: false, Icon: AlertCircle },
  pending_transcription: { color: "text-violet-300", spin: false, Icon: Volume2 },
};

export function ArchiveStatusPill({ status }: { status: WikiStatus }) {
  if (status === "ready") return null;
  const { color, spin, Icon } = META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold ${color}`}
    >
      <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
    </span>
  );
}
