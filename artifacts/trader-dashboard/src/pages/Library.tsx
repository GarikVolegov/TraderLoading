import { useState } from "react";
import { motion } from "framer-motion";
import {
  Library as LibraryIcon, FileText, Video, Network, Lock, Plus, Pencil, Trash2,
  Download, Upload, Loader2, Star, Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { MindMapEditor, MindMapView, isMindMapData, type MindMapData } from "@/components/MindMapEditor";

// ─── Types ──────────────────────────────────────────────────────────────────
type ContentType = "document" | "mindmap" | "video";

interface Content {
  id: number;
  collectionId: number | null;
  type: ContentType;
  title: string;
  description: string;
  bodyMarkdown: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  embedUrl: string | null;
  mindmap?: MindMapData | null;
  tags: string;
  requiredLevel: number;
  orderIndex: number;
  published: boolean;
}

const TYPE_META: Record<ContentType, { label: string; icon: typeof FileText; color: string }> = {
  document: { label: "Documento", icon: FileText, color: "#38bdf8" },
  mindmap:  { label: "Mappa mentale", icon: Network, color: "#a855f7" },
  video:    { label: "Video", icon: Video, color: "#f43f5e" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}
function parseTags(raw: string): string[] {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

// ─── Content viewer ───────────────────────────────────────────────────────────
function ContentViewer({ content, onClose }: { content: Content; onClose: () => void }) {
  const meta = TYPE_META[content.type];
  const embed = toEmbedUrl(content.embedUrl);
  const isPdf = content.mimeType === "application/pdf";
  const isImage = content.mimeType?.startsWith("image/");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <DialogTitle className="text-xl leading-snug pt-1">{content.title}</DialogTitle>
        </DialogHeader>

        {content.description && <p className="text-sm text-muted-foreground leading-relaxed">{content.description}</p>}

        {content.type === "video" && (
          embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/40">
              <iframe src={embed} title={content.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : <p className="text-sm text-amber-400">Link video non valido.</p>
        )}

        {content.type === "mindmap" && (
          isMindMapData(content.mindmap) ? (
            <MindMapView data={content.mindmap} />
          ) : embed ? (
            <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-border/40">
              <iframe src={embed} title={content.title} className="w-full h-full" allowFullScreen />
            </div>
          ) : (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center text-sm text-muted-foreground">
              <Network className="w-8 h-8 mx-auto mb-2 text-primary/60" />
              Mappa mentale vuota.
            </div>
          )
        )}

        {content.type === "document" && (
          <div className="space-y-3">
            {content.fileUrl && (isPdf || isImage) && (
              <div className="w-full overflow-hidden rounded-lg border border-border/40 bg-black/20">
                {isImage
                  ? <img src={content.fileUrl} alt="" className="w-full max-h-[60vh] object-contain" />
                  : <iframe src={content.fileUrl} title={content.title} className="w-full h-[70vh]" />}
              </div>
            )}
            {content.fileUrl && (
              <a href={content.fileUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Download className="w-4 h-4" /> {content.fileName ?? "Apri documento"}
              </a>
            )}
            {content.bodyMarkdown && (
              <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {content.bodyMarkdown}
              </div>
            )}
            {!content.fileUrl && !content.bodyMarkdown && <p className="text-sm text-muted-foreground">Nessun contenuto.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: content form ────────────────────────────────────────────────────
function ContentForm({ initial, onClose }: { initial: Content | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: (initial?.type ?? "document") as ContentType,
    title: initial?.title ?? "", description: initial?.description ?? "",
    bodyMarkdown: initial?.bodyMarkdown ?? "", embedUrl: initial?.embedUrl ?? "",
    fileUrl: initial?.fileUrl ?? "", fileName: initial?.fileName ?? "", fileSize: initial?.fileSize ?? 0, mimeType: initial?.mimeType ?? "",
    mindmap: (initial?.mindmap ?? null) as MindMapData | null,
    tags: parseTags(initial?.tags ?? "[]").join(", "),
    requiredLevel: initial?.requiredLevel ?? 0, orderIndex: initial?.orderIndex ?? 0, published: initial?.published ?? false,
  });
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, collectionId: initial?.collectionId ?? null, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      return initial
        ? apiJSON(`library/contents/${initial.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : apiJSON("library/contents", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library", "contents"] }); onClose(); },
  });

  async function uploadDoc(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch("library/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.fileUrl) setForm((f) => ({ ...f, fileUrl: d.fileUrl, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType }));
    } finally { setUploading(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader><DialogTitle>{initial ? "Modifica contenuto" : "Nuovo contenuto"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(Object.keys(TYPE_META) as ContentType[]).map((t) => {
              const M = TYPE_META[t];
              return (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${form.type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  <M.icon className="w-3.5 h-3.5" /> {M.label}
                </button>
              );
            })}
          </div>
          <input className="tl-input" placeholder="Titolo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="tl-input min-h-16" placeholder="Descrizione" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          {form.type === "video" && (
            <input className="tl-input" placeholder="Link YouTube / Vimeo" value={form.embedUrl} onChange={(e) => setForm({ ...form, embedUrl: e.target.value })} />
          )}
          {form.type === "mindmap" && (
            <MindMapEditor initial={form.mindmap} onChange={(d) => setForm((f) => ({ ...f, mindmap: d }))} />
          )}
          {form.type === "document" && (
            <>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm rounded-md border border-border px-3 py-2 hover:bg-secondary/40">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica file
                  <input type="file" hidden onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
                </label>
                {form.fileName && <span className="text-xs text-muted-foreground truncate max-w-[16rem]">{form.fileName}</span>}
              </div>
              <textarea className="tl-input min-h-24" placeholder="Testo / note (opzionale)" value={form.bodyMarkdown} onChange={(e) => setForm({ ...form, bodyMarkdown: e.target.value })} />
            </>
          )}

          <input className="tl-input" placeholder="Tag separati da virgola" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Livello di sblocco (0 = sempre)
              <input type="number" min={0} className="tl-input mt-1" value={form.requiredLevel} onChange={(e) => setForm({ ...form, requiredLevel: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-muted-foreground">Ordine
              <input type="number" className="tl-input mt-1" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Pubblicato
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
            <Button size="sm" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Content card ─────────────────────────────────────────────────────────────
function ContentCard({ item, locked, isAdmin, onOpen, onEdit, onDelete }: {
  item: Content; locked: boolean; isAdmin: boolean;
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const M = TYPE_META[item.type];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="tl-panel p-4 flex flex-col gap-2 border-border/40">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: M.color }}>
          <M.icon className="w-3.5 h-3.5" /> {M.label}
        </span>
        <div className="flex items-center gap-1">
          {!item.published && <span className="text-[9px] text-amber-400 font-bold">BOZZA</span>}
          {isAdmin && (
            <>
              <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>
      <h3 className="font-bold text-sm leading-snug">{item.title}</h3>
      {item.description && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{item.description}</p>}
      <Button variant={locked ? "outline" : "default"} size="sm" disabled={locked} onClick={onOpen} className="mt-auto">
        {locked ? <><Lock className="w-3.5 h-3.5 mr-1" /> Livello {item.requiredLevel}</> : "Apri"}
      </Button>
    </motion.div>
  );
}

// ─── Main page: unlock-by-level feed (like the Settings rewards library) ──────
export default function Library() {
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const userLevel = (profile as { level?: number } | undefined)?.level ?? 0;

  const { data: admin } = useQuery<{ isAdmin: boolean }>({ queryKey: ["library", "admin"], queryFn: () => apiJSON("library/admin/status") });
  const isAdmin = admin?.isAdmin ?? false;

  const { data: contents = [] } = useQuery<Content[]>({ queryKey: ["library", "contents"], queryFn: () => apiJSON("library/contents") });

  const [viewing, setViewing] = useState<Content | null>(null);
  const [editContent, setEditContent] = useState<Content | null | "new">(null);

  const delContent = useMutation({
    mutationFn: (id: number) => apiJSON(`library/contents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "contents"] }),
  });

  // Group by unlock level.
  const byLevel = new Map<number, Content[]>();
  for (const c of contents) {
    const lvl = c.requiredLevel ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(c);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const unlockedLevels = levels.filter((l) => l <= userLevel || isAdmin);
  const lockedLevels = isAdmin ? [] : levels.filter((l) => l > userLevel);

  const nextLevel = levels.find((l) => l > userLevel) ?? null;
  const prevMilestone = levels.filter((l) => l <= userLevel).at(-1) ?? 0;
  const progress = nextLevel ? Math.max(0, Math.min(100, Math.round(((userLevel - prevMilestone) / (nextLevel - prevMilestone)) * 100))) : 100;

  return (
    <PageLayout>
      <PageHeader
        title="Biblioteca"
        subtitle="Premi e contenuti formativi sbloccati in base al tuo livello"
        action={isAdmin ? <Button size="sm" onClick={() => setEditContent("new")}><Plus className="w-4 h-4 mr-1" /> Contenuto</Button> : undefined}
      />

      {/* Progress to next unlock */}
      {contents.length > 0 && (
        <div className="tl-panel p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold"><Star className="w-4 h-4 text-primary" /> Livello {userLevel}</span>
            {nextLevel
              ? <span className="text-xs text-muted-foreground">Prossimo sblocco al livello <span className="text-primary font-bold">{nextLevel}</span></span>
              : <span className="text-xs text-primary font-semibold">Tutti i contenuti sbloccati!</span>}
          </div>
          {nextLevel && (
            <>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Ancora {nextLevel - userLevel} livell{nextLevel - userLevel !== 1 ? "i" : "o"} per sbloccare nuovi contenuti
              </p>
            </>
          )}
        </div>
      )}

      {/* Unlocked levels */}
      {unlockedLevels.map((level) => (
        <div key={level} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 border border-primary/30 rounded-full">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-primary">{level === 0 ? "Sempre disponibile" : `Livello ${level}`}</span>
            </div>
            {isAdmin && level > userLevel && <span className="text-[10px] text-amber-400 font-semibold">anteprima admin</span>}
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byLevel.get(level)!.map((item) => (
              <ContentCard key={item.id} item={item} isAdmin={isAdmin}
                locked={item.requiredLevel > userLevel && !isAdmin}
                onOpen={() => setViewing(item)} onEdit={() => setEditContent(item)} onDelete={() => delContent.mutate(item.id)} />
            ))}
          </div>
        </div>
      ))}

      {/* Locked levels */}
      {lockedLevels.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contenuti bloccati</p>
          {lockedLevels.map((level) => {
            const count = byLevel.get(level)!.length;
            return (
              <div key={level} className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-secondary/20 opacity-70">
                <div className="w-10 h-10 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{count} contenut{count !== 1 ? "i" : "o"} al livello {level}</p>
                  <p className="text-xs text-muted-foreground">Raggiungi il livello {level} per sbloccarli</p>
                </div>
                <span className="ml-auto text-[11px] text-muted-foreground/70 font-mono">Lvl {level}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {contents.length === 0 && (
        <div className="tl-panel p-10 sm:p-16 text-center">
          <LibraryIcon className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <h3 className="text-xl font-bold mb-2">Biblioteca in costruzione</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {isAdmin ? "Aggiungi il primo contenuto e assegnagli un livello di sblocco." : "Presto qui troverai contenuti formativi sbloccabili salendo di livello."}
          </p>
          <div className="mt-8 grid max-w-md mx-auto grid-cols-3 gap-3">
            {(Object.keys(TYPE_META) as ContentType[]).map((type) => {
              const M = TYPE_META[type];
              return (
                <div key={type} className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-4">
                  <M.icon className="mx-auto h-6 w-6" style={{ color: M.color }} />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">{M.label}</p>
                </div>
              );
            })}
          </div>
          {!isAdmin && (
            <p className="mt-4 text-xs text-muted-foreground/70">
              Nel frattempo accumula XP completando missioni e routine: i contenuti si sbloccano per livello.
            </p>
          )}
        </div>
      )}

      {viewing && <ContentViewer content={viewing} onClose={() => setViewing(null)} />}
      {editContent !== null && <ContentForm initial={editContent === "new" ? null : editContent} onClose={() => setEditContent(null)} />}
    </PageLayout>
  );
}
