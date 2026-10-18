import { uiText } from "@/contexts/LanguageContext";
import { archiveSourceKey, archiveTypeOf, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";

export function ArchiveMiniCard({ source, onOpen }: { source: WikiSource; onOpen: (id: string) => void }) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  return (
    <button
      type="button"
      draggable={!source.readOnly}
      disabled={source.unavailable}
      onDragStart={(e) => {
        if (source.readOnly) { e.preventDefault(); return; }
        e.dataTransfer.setData(ARCHIVE_DND_TYPE, String(source.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(archiveSourceKey(source))}
      className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-secondary/40 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45"
    >
      <span className="flex items-center gap-1.5" style={{ color: accent }}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[9.5px] uppercase tracking-wide">{typeLabel(type)}</span>
      </span>
      <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">{source.title}</p>
      {source.originLabelKey && <span className="text-[10px] text-muted-foreground">{uiText(source.originLabelKey)}</span>}
      {source.unavailable && <span className="text-[10px] text-muted-foreground">{uiText("reorg.archive.unavailable")}</span>}
      <span className="font-mono text-[10px] text-muted-foreground">{formatDate(source.createdAt)}</span>
    </button>
  );
}
