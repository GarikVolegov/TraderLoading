import { archiveTypeOf, parseTags, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";
import { ArchiveStatusPill } from "./ArchiveStatusPill";

export function ArchiveRow({ source, onOpen }: { source: WikiSource; onOpen: (id: number) => void }) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  const tags = parseTags(source.tags).slice(0, 2);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ARCHIVE_DND_TYPE, String(source.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(source.id)}
      className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/55 px-3.5 py-[var(--arc-rowpad,11px)] text-left transition-all hover:border-primary/45 hover:bg-card/70"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-background/50"
        style={{ color: accent }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold text-foreground">{source.title}</p>
          <ArchiveStatusPill status={source.status} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: accent }}>
          {typeLabel(type)}
        </span>
      </div>
      <div className="hidden shrink-0 gap-1 sm:flex">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-md border border-border/35 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            #{t}
          </span>
        ))}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatDate(source.createdAt)}</span>
    </button>
  );
}
