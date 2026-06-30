import { archiveTypeOf, parseTags, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";
import { ArchiveStatusPill } from "./ArchiveStatusPill";

interface Props {
  source: WikiSource;
  onOpen: (id: number) => void;
}

export function ArchiveCard({ source, onOpen }: Props) {
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
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card/65 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <div
        className="relative flex h-[var(--arc-cover,150px)] flex-col items-center justify-center gap-2 border-b border-border/35"
        style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 14%, transparent), hsl(226 43% 10% / .55))` }}
      >
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/65 px-2 py-0.5"
          style={{ color: accent }}
        >
          <Icon className="h-3 w-3" />
          <span className="font-mono text-[9px] uppercase tracking-wider">{typeLabel(type)}</span>
        </span>
        <span className="absolute right-2 top-2">
          <ArchiveStatusPill status={source.status} />
        </span>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-background/50"
          style={{ color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-[var(--arc-pad,13px)]">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{source.title}</p>
        <div className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{formatDate(source.createdAt)}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-border/35 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
