import { FileText, Globe2, Image as ImageIcon, StickyNote, Video, Volume2, type LucideIcon } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { TYPE_LABEL_KEY, type ArchiveType } from "@/lib/archive";

// Shared DnD payload key so item drag stays compatible with the ArchiveRail
// collection drop targets.
export const ARCHIVE_DND_TYPE = "application/x-wiki-source";

const ICONS: Record<ArchiveType, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  pdf: FileText,
  audio: Volume2,
  link: Globe2,
  note: StickyNote,
};

export function typeIcon(type: ArchiveType): LucideIcon {
  return ICONS[type];
}

export function typeLabel(type: ArchiveType): string {
  return uiText(TYPE_LABEL_KEY[type]);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
