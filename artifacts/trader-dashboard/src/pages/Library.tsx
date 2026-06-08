import { useState } from "react";
import { motion } from "framer-motion";
import {
  Library as LibraryIcon, FileText, Video, Network, Lock, Plus, Pencil, Trash2,
  ChevronLeft, ExternalLink, Download, Upload, X, Eye, EyeOff, Loader2,
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

interface Collection {
  id: number;
  title: string;
  description: string;
  coverImageUrl: string | null;
  category: string;
  requiredLevel: number;
  orderIndex: number;
  published: boolean;
}
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

// ─── Admin: collection form ─────────────────────────────────────────────────
function CollectionForm({ initial, onClose }: { initial: Collection | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "", description: initial?.description ?? "", category: initial?.category ?? "",
    coverImageUrl: initial?.coverImageUrl ?? "", requiredLevel: initial?.requiredLevel ?? 0,
    orderIndex: initial?.orderIndex ?? 0, published: initial?.published ?? false,
  });
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: () => initial
      ? apiJSON(`library/collections/${initial.id}`, { method: "PUT", body: JSON.stringify(form) })
      : apiJSON("library/collections", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library", "collections"] }); onClose(); },
  });

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch("library/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (data.fileUrl) setForm((f) => ({ ...f, coverImageUrl: data.fileUrl }));
    } finally { setUploading(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader><DialogTitle>{initial ? "Modifica collezione" : "Nuova collezione"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input className="tl-input" placeholder="Titolo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="tl-input min-h-20" placeholder="Descrizione" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="tl-input" placeholder="Categoria (es. Psicologia, Price Action)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm rounded-md border border-border px-3 py-2 hover:bg-secondary/40">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Copertina
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
            </label>
            {form.coverImageUrl && <img src={form.coverImageUrl} alt="" className="h-9 w-14 rounded object-cover border border-border/40" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Livello richiesto
              <input type="number" min={0} className="tl-input mt-1" value={form.requiredLevel} onChange={(e) => setForm({ ...form, requiredLevel: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-muted-foreground">Ordine
              <input type="number" className="tl-input mt-1" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Pubblicata
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

// ─── Admin: content form ────────────────────────────────────────────────────
function ContentForm({ collectionId, initial, onClose }: { collectionId: number; initial: Content | null; onClose: () => void }) {
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
      const payload = { ...form, collectionId, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      return initial
        ? apiJSON(`library/contents/${initial.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : apiJSON("library/contents", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library", "collection", collectionId] }); onClose(); },
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
      <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
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
              <textarea className="tl-input min-h-24" placeholder="Testo / note (opzionale, markdown semplice)" value={form.bodyMarkdown} onChange={(e) => setForm({ ...form, bodyMarkdown: e.target.value })} />
            </>
          )}

          <input className="tl-input" placeholder="Tag separati da virgola" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Livello richiesto
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

// ─── Main page ──────────────────────────────────────────────────────────────
export default function Library() {
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const userLevel = (profile as { level?: number } | undefined)?.level ?? 0;

  const { data: admin } = useQuery<{ isAdmin: boolean }>({ queryKey: ["library", "admin"], queryFn: () => apiJSON("library/admin/status") });
  const isAdmin = admin?.isAdmin ?? false;

  const { data: collections = [] } = useQuery<Collection[]>({ queryKey: ["library", "collections"], queryFn: () => apiJSON("library/collections") });

  const [openId, setOpenId] = useState<number | null>(null);
  const { data: detail } = useQuery<{ collection: Collection; contents: Content[] }>({
    queryKey: ["library", "collection", openId],
    queryFn: () => apiJSON(`library/collections/${openId}`),
    enabled: openId !== null,
  });

  const [viewing, setViewing] = useState<Content | null>(null);
  const [editCollection, setEditCollection] = useState<Collection | null | "new">(null);
  const [editContent, setEditContent] = useState<Content | null | "new">(null);

  const delCollection = useMutation({
    mutationFn: (id: number) => apiJSON(`library/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library", "collections"] }); setOpenId(null); },
  });
  const delContent = useMutation({
    mutationFn: (id: number) => apiJSON(`library/contents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "collection", openId] }),
  });

  // ── Collection detail view ──
  if (openId !== null && detail) {
    const c = detail.collection;
    return (
      <PageLayout>
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Biblioteca
        </button>
        <PageHeader title={c.title} subtitle={c.description || c.category}
          action={isAdmin ? <Button size="sm" onClick={() => setEditContent("new")}><Plus className="w-4 h-4 mr-1" /> Contenuto</Button> : undefined} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {detail.contents.map((item) => {
            const M = TYPE_META[item.type];
            const locked = item.requiredLevel > userLevel && !isAdmin;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="tl-panel p-4 flex flex-col gap-2 border-border/40">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: M.color }}>
                    <M.icon className="w-3.5 h-3.5" /> {M.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {!item.published && <span className="text-[9px] text-amber-400 font-bold">BOZZA</span>}
                    {isAdmin && (
                      <>
                        <button onClick={() => setEditContent(item)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => delContent.mutate(item.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-sm leading-snug">{item.title}</h3>
                {item.description && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{item.description}</p>}
                <Button variant={locked ? "outline" : "default"} size="sm" disabled={locked} onClick={() => setViewing(item)} className="mt-auto">
                  {locked ? <><Lock className="w-3.5 h-3.5 mr-1" /> Livello {item.requiredLevel}</> : "Apri"}
                </Button>
              </motion.div>
            );
          })}
          {detail.contents.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Nessun contenuto in questa collezione.</p>}
        </div>

        {viewing && <ContentViewer content={viewing} onClose={() => setViewing(null)} />}
        {editContent !== null && <ContentForm collectionId={openId} initial={editContent === "new" ? null : editContent} onClose={() => setEditContent(null)} />}
      </PageLayout>
    );
  }

  // ── Collections grid ──
  return (
    <PageLayout>
      <PageHeader
        title="Biblioteca"
        subtitle="Documenti, mappe mentali e video di alto valore"
        action={isAdmin ? <Button size="sm" onClick={() => setEditCollection("new")}><Plus className="w-4 h-4 mr-1" /> Collezione</Button> : undefined}
      />

      {collections.length === 0 ? (
        <div className="tl-panel p-16 text-center">
          <LibraryIcon className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <h3 className="text-xl font-bold mb-2">Biblioteca in costruzione</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {isAdmin ? "Crea la prima collezione per iniziare a pubblicare contenuti." : "Presto qui troverai contenuti formativi esclusivi."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => {
            const locked = c.requiredLevel > userLevel && !isAdmin;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
                className="tl-panel overflow-hidden border-border/40 cursor-pointer group"
                onClick={() => !locked && setOpenId(c.id)}>
                <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-primary/15 to-transparent">
                  {c.coverImageUrl
                    ? <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><LibraryIcon className="w-10 h-10 text-primary/30" /></div>}
                  {locked && <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center"><span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Lock className="w-3.5 h-3.5" /> Livello {c.requiredLevel}</span></div>}
                  {!c.published && <span className="absolute top-2 right-2 text-[9px] font-bold text-amber-400 bg-background/80 rounded px-1.5 py-0.5">BOZZA</span>}
                </div>
                <div className="p-4">
                  {c.category && <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">{c.category}</span>}
                  <h3 className="font-bold text-sm leading-snug mt-0.5">{c.title}</h3>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>}
                  {isAdmin && (
                    <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditCollection(c)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delCollection.mutate(c.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      <span className="ml-auto text-[10px] text-muted-foreground/60 inline-flex items-center gap-1">{c.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {editCollection !== null && <CollectionForm initial={editCollection === "new" ? null : editCollection} onClose={() => setEditCollection(null)} />}
    </PageLayout>
  );
}
