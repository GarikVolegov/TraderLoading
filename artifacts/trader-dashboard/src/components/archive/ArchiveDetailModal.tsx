import { useEffect, useState } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { archiveTypeOf, parseTags, TYPE_ACCENT, type Collection, type WikiSource } from "@/lib/archive";
import { typeIcon, typeLabel } from "./typeMeta";

interface Props {
  source: WikiSource;
  collection: Collection | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onSaveTags: (id: number, tags: string[]) => void;
}

export function ArchiveDetailModal({ source, collection, onClose, onDelete, onSaveTags }: Props) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  const [tags, setTags] = useState<string[]>(() => parseTags(source.tags));
  const [draft, setDraft] = useState("");
  const href = source.fileUrl ?? source.originalUrl ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = (next: string[]) => {
    setTags(next);
    onSaveTags(source.id, next);
  };
  const addTag = () => {
    const t = draft.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) commit([...tags, t]);
    setDraft("");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-[min(720px,100%)] overflow-auto rounded-2xl border border-border/60 bg-card shadow-2xl"
      >
        <div
          className="relative flex h-44 items-center justify-center border-b border-border/40"
          style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 16%, transparent), hsl(226 43% 10% / .55))` }}
        >
          <span
            className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/65 px-2.5 py-1"
            style={{ color: accent }}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider">{typeLabel(type)}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={uiText("archive.close")}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-background/55"
            style={{ color: accent }}
          >
            <Icon className="h-8 w-8" />
          </span>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            {collection && (
              <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: collection.accent }} />
                {collection.name}
              </span>
            )}
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">{source.title}</h2>
          </div>

          {source.error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {source.error}
            </p>
          )}
          {source.extractedText && (
            <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {source.extractedText}
            </p>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-px overflow-hidden rounded-lg border border-border/35 bg-border/30">
            <Meta label={uiText("archive.meta.type")} value={typeLabel(type)} />
            <Meta
              label={uiText("archive.meta.collection")}
              value={collection?.name ?? uiText("archive.collections.unfiled")}
            />
            <Meta label={uiText("archive.meta.date")} value={new Date(source.createdAt).toLocaleDateString("it-IT")} />
            {source.fileName && <Meta label={uiText("archive.meta.file")} value={source.fileName} />}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {uiText("archive.tags")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">{uiText("archive.tags.empty")}</span>}
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary/50 px-2 py-1 font-mono text-[11px] text-foreground"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => commit(tags.filter((x) => x !== t))}
                    aria-label={uiText("archive.delete")}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder={uiText("archive.tags.add_placeholder")}
                className="h-7 w-28 rounded-md border border-border/50 bg-background px-2 font-mono text-[11px] outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/45"
              >
                <ExternalLink className="h-4 w-4" />
                {uiText("archive.open")}
              </a>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(uiText("archive.delete_confirm", { title: source.title }))) onDelete(source.id);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-[13px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              {uiText("archive.delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/90 px-3 py-2.5">
      <p className="mb-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="truncate text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}
