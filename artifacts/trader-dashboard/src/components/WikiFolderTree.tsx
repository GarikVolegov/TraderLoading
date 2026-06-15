import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Files,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { API_BASE as API, apiFetch } from "@/lib/apiFetch";
import { uiText } from "@/contexts/LanguageContext";

export type WikiFolderFilter = "all" | "root" | number;

export interface WikiFolder {
  id: number;
  name: string;
  parentId: number | null;
  color: string | null;
  position: number;
}

// Data attribute key used to ferry a dragged source id from a SourceRow to a
// folder drop target.
export const WIKI_SOURCE_DND_TYPE = "application/x-wiki-source";

interface Props {
  selected: WikiFolderFilter;
  onSelect: (filter: WikiFolderFilter) => void;
  /** Map of source counts keyed by folderId (or "root" for unfiled), for badges. */
  counts?: Record<string, number>;
}

export function WikiFolderTree({ selected, onSelect, counts }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsedInit, setCollapsedInit] = useState(false);
  const [creatingUnder, setCreatingUnder] = useState<number | null | undefined>(undefined);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState<WikiFolderFilter | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ["wiki", "folders"],
    queryFn: () => apiFetch<WikiFolder[]>(`${API}/wiki/folders`),
  });

  // Expand everything the first time folders arrive.
  if (!collapsedInit && folders.length) {
    setExpanded(new Set(folders.map((f) => f.id)));
    setCollapsedInit(true);
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wiki", "folders"] });
    qc.invalidateQueries({ queryKey: ["wiki", "sources"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: { name: string; parentId: number | null }) =>
      apiFetch<WikiFolder>(`${API}/wiki/folders`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (folder) => {
      setCreatingUnder(undefined);
      setNewName("");
      setExpanded((prev) => (folder.parentId ? new Set(prev).add(folder.parentId) : prev));
      invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: number; name: string }) =>
      apiFetch<WikiFolder>(`${API}/wiki/folders/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: input.name }),
      }),
    onSuccess: () => {
      setRenamingId(null);
      setRenameValue("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/wiki/folders/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      if (selected === id) onSelect("all");
      invalidate();
    },
  });

  const moveMutation = useMutation({
    mutationFn: (input: { sourceId: number; folderId: number | null }) =>
      apiFetch(`${API}/wiki/sources/${input.sourceId}`, {
        method: "PATCH",
        body: JSON.stringify({ folderId: input.folderId }),
      }),
    onSuccess: invalidate,
  });

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, WikiFolder[]>();
    for (const folder of folders) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  const dropSourceOn = (folderId: number | null, event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(null);
    const raw = event.dataTransfer.getData(WIKI_SOURCE_DND_TYPE);
    const sourceId = Number(raw);
    if (raw && !Number.isNaN(sourceId)) moveMutation.mutate({ sourceId, folderId });
  };

  const rowBase =
    "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer";

  const renderFolder = (folder: WikiFolder, depth: number) => {
    const kids = childrenOf.get(folder.id) ?? [];
    const isOpen = expanded.has(folder.id);
    const isSelected = selected === folder.id;
    const count = counts?.[String(folder.id)] ?? 0;
    return (
      <div key={folder.id}>
        <div
          className={`${rowBase} ${isSelected ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"} ${
            dragOver === folder.id ? "ring-1 ring-primary" : ""
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect(folder.id)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(folder.id);
          }}
          onDragLeave={() => setDragOver((cur) => (cur === folder.id ? null : cur))}
          onDrop={(event) => dropSourceOn(folder.id, event)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(folder.id)) next.delete(folder.id);
                else next.add(folder.id);
                return next;
              });
            }}
            className={`shrink-0 text-muted-foreground ${kids.length ? "" : "invisible"}`}
            aria-label={isOpen ? "Comprimi" : "Espandi"}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {isOpen && kids.length ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary/80" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-primary/80" />
          )}
          {renamingId === folder.id ? (
            <input
              autoFocus
              value={renameValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && renameValue.trim())
                  renameMutation.mutate({ id: folder.id, name: renameValue.trim() });
                if (event.key === "Escape") setRenamingId(null);
              }}
              onBlur={() => setRenamingId(null)}
              className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-xs"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          )}
          {count > 0 && renamingId !== folder.id && (
            <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
          )}
          <span className="ml-1 hidden items-center gap-0.5 group-hover:flex">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setCreatingUnder(folder.id);
                setNewName("");
                setExpanded((prev) => new Set(prev).add(folder.id));
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-primary"
              aria-label={uiText("wiki.folders.new_sub")}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setRenamingId(folder.id);
                setRenameValue(folder.name);
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-primary"
              aria-label={uiText("wiki.folders.rename")}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(uiText("wiki.folders.delete_confirm", { name: folder.name })))
                  deleteMutation.mutate(folder.id);
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-red-400"
              aria-label={uiText("wiki.folders.delete")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        </div>
        {creatingUnder === folder.id && (
          <NewFolderInput
            depth={depth + 1}
            value={newName}
            pending={createMutation.isPending}
            onChange={setNewName}
            onCancel={() => setCreatingUnder(undefined)}
            onSubmit={() =>
              newName.trim() && createMutation.mutate({ name: newName.trim(), parentId: folder.id })
            }
          />
        )}
        {isOpen && kids.map((kid) => renderFolder(kid, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf.get(null) ?? [];
  const allCount = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold text-muted-foreground">{uiText("wiki.folders.title")}</span>
        <button
          type="button"
          onClick={() => {
            setCreatingUnder(null);
            setNewName("");
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nuova
        </button>
      </div>

      <div
        className={`${rowBase} ${selected === "all" ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"}`}
        onClick={() => onSelect("all")}
      >
        <Files className="ml-4.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{uiText("wiki.folders.all")}</span>
        {allCount > 0 && <span className="font-mono text-[10px] text-muted-foreground">{allCount}</span>}
      </div>

      <div
        className={`${rowBase} ${selected === "root" ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"} ${
          dragOver === "root" ? "ring-1 ring-primary" : ""
        }`}
        onClick={() => onSelect("root")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver("root");
        }}
        onDragLeave={() => setDragOver((cur) => (cur === "root" ? null : cur))}
        onDrop={(event) => dropSourceOn(null, event)}
      >
        <Inbox className="ml-4.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{uiText("wiki.folders.unfiled")}</span>
        {counts?.root ? (
          <span className="font-mono text-[10px] text-muted-foreground">{counts.root}</span>
        ) : null}
      </div>

      {creatingUnder === null && (
        <NewFolderInput
          depth={0}
          value={newName}
          pending={createMutation.isPending}
          onChange={setNewName}
          onCancel={() => setCreatingUnder(undefined)}
          onSubmit={() => newName.trim() && createMutation.mutate({ name: newName.trim(), parentId: null })}
        />
      )}

      {roots.map((folder) => renderFolder(folder, 0))}
    </div>
  );
}

function NewFolderInput({
  depth,
  value,
  pending,
  onChange,
  onSubmit,
  onCancel,
}: {
  depth: number;
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1 py-1" style={{ paddingLeft: 8 + depth * 14 + 18 }}>
      <input
        autoFocus
        value={value}
        placeholder={uiText("wiki.folders.name_placeholder")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel();
        }}
        className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || !value.trim()}
        className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40"
        aria-label={uiText("wiki.folders.create")}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded p-1 text-muted-foreground hover:text-red-400"
        aria-label={uiText("wiki.folders.cancel")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
