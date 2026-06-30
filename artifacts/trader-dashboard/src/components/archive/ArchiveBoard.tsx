import { uiText } from "@/contexts/LanguageContext";
import { ArchiveMiniCard } from "./ArchiveMiniCard";
import type { Collection, WikiSource } from "@/lib/archive";

export interface BoardColumn {
  collection: Collection | null; // null = unfiled
  items: WikiSource[];
}

export function ArchiveBoard({ columns, onOpen }: { columns: BoardColumn[]; onOpen: (id: number) => void }) {
  return (
    <div className="grid auto-cols-[minmax(244px,1fr)] grid-flow-col gap-3.5 overflow-x-auto pb-2">
      {columns.map((col, i) => {
        const accent = col.collection?.accent ?? "hsl(214 26% 74%)";
        const name = col.collection?.name ?? uiText("archive.collections.unfiled");
        return (
          <div
            key={col.collection?.id ?? `unfiled-${i}`}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/40 bg-card/50 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="flex-1 truncate font-mono text-xs font-bold text-foreground">{name}</span>
              <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {col.items.length}
              </span>
            </div>
            {col.items.map((s) => (
              <ArchiveMiniCard key={s.id} source={s} onOpen={onOpen} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
