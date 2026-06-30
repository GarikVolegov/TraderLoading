import { useState } from "react";
import { Files, FolderPlus, Inbox } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import type { Collection, TagCount } from "@/lib/archive";
import { ARCHIVE_DND_TYPE } from "./typeMeta";

interface Props {
  collections: Collection[];
  collectionFilter: "all" | "root" | number;
  onCollectionChange: (value: "all" | "root" | number) => void;
  allCount: number;
  unfiledCount: number;
  tagCloud: TagCount[];
  tagFilter: string | null;
  onTagChange: (tag: string | null) => void;
  onMoveSource: (sourceId: number, folderId: number | null) => void;
  onCreateCollection: (name: string) => void;
}

export function ArchiveRail(props: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [dropTarget, setDropTarget] = useState<"root" | number | null>(null);

  const handleDrop = (folderId: number | null, target: "root" | number, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData(ARCHIVE_DND_TYPE);
    const sourceId = Number(raw);
    if (raw && !Number.isNaN(sourceId)) props.onMoveSource(sourceId, folderId);
  };

  const rowCls = (active: boolean, isDrop: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
      active
        ? "border-border/60 bg-secondary/70 text-foreground"
        : "border-transparent text-muted-foreground hover:bg-secondary/40"
    } ${isDrop ? "ring-1 ring-primary" : ""}`;

  return (
    <aside className="w-full space-y-3.5 xl:w-[248px] xl:shrink-0">
      <div className="tl-panel space-y-1 p-3.5">
        <span className="px-1.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {uiText("archive.collections")}
        </span>

        <button
          type="button"
          className={rowCls(props.collectionFilter === "all", false)}
          onClick={() => props.onCollectionChange("all")}
        >
          <Files className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{uiText("archive.collections.all")}</span>
          {props.allCount > 0 && <span className="font-mono text-[11px] opacity-70">{props.allCount}</span>}
        </button>

        <button
          type="button"
          className={rowCls(props.collectionFilter === "root", dropTarget === "root")}
          onClick={() => props.onCollectionChange("root")}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget("root");
          }}
          onDragLeave={() => setDropTarget((c) => (c === "root" ? null : c))}
          onDrop={(e) => handleDrop(null, "root", e)}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{uiText("archive.collections.unfiled")}</span>
          {props.unfiledCount > 0 && (
            <span className="font-mono text-[11px] opacity-70">{props.unfiledCount}</span>
          )}
        </button>

        {props.collections.map((c) => (
          <button
            key={c.id}
            type="button"
            className={rowCls(props.collectionFilter === c.id, dropTarget === c.id)}
            onClick={() => props.onCollectionChange(c.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(c.id);
            }}
            onDragLeave={() => setDropTarget((cur) => (cur === c.id ? null : cur))}
            onDrop={(e) => handleDrop(c.id, c.id, e)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.accent }} />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="font-mono text-[11px] opacity-70">{c.count}</span>
          </button>
        ))}

        {creating ? (
          <input
            autoFocus
            value={name}
            placeholder={uiText("wiki.folders.name_placeholder")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                props.onCreateCollection(name.trim());
                setName("");
                setCreating(false);
              }
              if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
            onBlur={() => {
              setCreating(false);
              setName("");
            }}
            className="mt-1.5 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {uiText("archive.collections.new")}
          </button>
        )}
      </div>

      {props.tagCloud.length > 0 && (
        <div className="tl-panel space-y-2.5 p-3.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {uiText("archive.tags")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {props.tagCloud.map((t) => {
              const active = props.tagFilter === t.tag;
              return (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => props.onTagChange(active ? null : t.tag)}
                  data-active={active ? "1" : undefined}
                  className="inline-flex items-center rounded-md border border-border/35 bg-secondary/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/45 data-[active]:border-primary/55 data-[active]:bg-primary/15 data-[active]:text-primary"
                >
                  #{t.tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
