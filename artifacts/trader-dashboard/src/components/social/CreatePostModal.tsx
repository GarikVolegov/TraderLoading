import { useState, useRef, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { uiText } from "@/contexts/LanguageContext";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  X,
  FileText,
  Clock,
  ImageIcon,
  Loader2,
  Smile,
  Send,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { PostSphere } from "./PostCard";

const SPHERE_OPTIONS: {
  id: PostSphere;
  tag: string;
  label: string;
  subtitle: string;
  placeholder: string;
  Icon: typeof Sparkles;
}[] = [
  {
    id: "vita",
    tag: "VITA & STILE",
    label: "Vita & Stile",
    subtitle: "Lifestyle, postazione, viaggi, giornata",
    placeholder:
      "Racconta un momento della tua giornata, mostra la tua postazione, un viaggio o il tuo stile di vita...",
    Icon: Sparkles,
  },
  {
    id: "tempio",
    tag: "TEMPIO FISICO",
    label: "Tempio Fisico",
    subtitle: "Allenamento, disciplina, routine, mindset",
    placeholder:
      "Condividi la tua routine mattutina, l'allenamento fisico, la preparazione mentale o una lettura...",
    Icon: Dumbbell,
  },
  {
    id: "analisi",
    tag: "ANALISI",
    label: "Analisi & Mercato",
    subtitle: "Visione grafica, esecuzioni, debriefing",
    placeholder:
      "Condividi la tua visione di mercato, uno studio grafico o il bilancio di una sessione...",
    Icon: TrendingUp,
  },
  {
    id: "traguardo",
    tag: "TRAGUARDO",
    label: "Traguardo",
    subtitle: "Risultati, crescita personale, eredità",
    placeholder:
      "Celebra un traguardo raggiunto, una nuova consapevolezza o un passo avanti nel tuo percorso...",
    Icon: Trophy,
  },
];

export function CreatePostModal({
  onClose,
  currentUserId: _currentUserId,
  initialSphere = "vita",
  initialIsStory = false,
}: {
  onClose: () => void;
  currentUserId: string;
  initialSphere?: PostSphere;
  initialIsStory?: boolean;
}) {
  const [content, setContent] = useState("");
  const [isStory, setIsStory] = useState(initialIsStory);
  const [sphere, setSphere] = useState<PostSphere>(initialSphere);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [custodeStatus, setCustodeStatus] = useState<"INTEGRITA_100" | "REVISIONE">("INTEGRITA_100");
  const [libroLesson, setLibroLesson] = useState("");
  const [attachProtocolReport, setAttachProtocolReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const activeSphereMeta =
    SPHERE_OPTIONS.find((s) => s.id === sphere) ?? SPHERE_OPTIONS[0];

  const createPost = useMutation({
    mutationFn: (data: {
      content: string;
      isStory: boolean;
      imageUrl?: string;
    }) =>
      apiJSON("social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/stories"] });
      qc.invalidateQueries({ queryKey: ["social/profile"] });
      onClose();
    },
  });

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("social/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { imageUrl: url } = await res.json();
      setImageUrl(url);
    } catch {
      // silently fail
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
    setShowEmoji(false);
  };

  const handleSubmit = () => {
    const rawContent = content.trim();
    const rawLesson = libroLesson.trim();
    if (!rawContent && !rawLesson && !imageUrl) return;

    const sphereHeader = !isStory ? `[SFERA: ${activeSphereMeta.tag}]` : "";

    const protocolBlock =
      !isStory && attachProtocolReport
        ? [
            `[CUSTODE DELLA SOGLIA: ${
              custodeStatus === "INTEGRITA_100"
                ? "ALLINEAMENTO 100% · LUCIDITÀ OPERATIVA"
                : "REVISIONE CRITICA · ESITAZIONE RILEVATA"
            }]`,
            rawLesson ? `[LIBRO DELLA VERITÀ · LEZIONE]: ${rawLesson}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : !isStory && rawLesson
          ? `[LIBRO DELLA VERITÀ · LEZIONE]: ${rawLesson}`
          : "";

    const finalContent = [sphereHeader, protocolBlock, rawContent]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 2000);

    createPost.mutate({
      content: finalContent || "Nuovo contenuto pubblicato nel profilo.",
      isStory,
      imageUrl: imageUrl ?? undefined,
    });
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const { titleId, panelProps } = useDialogA11y({
    isOpen: true,
    onClose,
    panelRef,
    initialFocusRef: textareaRef,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        {...panelProps}
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0C0D13] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl p-5 space-y-4 border border-[#C5A059]/35 text-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
              PROFILO PUBBLICO · CRONACHE DELL&apos;ORDINE
            </span>
            <h2 id={titleId} className="font-display font-bold text-lg text-white">
              {isStory
                ? "Storia 24h · Momento della Giornata"
                : "Pubblica nel Tuo Profilo Pubblico"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={uiText("common.close")}
            className="p-1.5 rounded-lg border border-[#C5A059]/20 bg-[#12131A] hover:bg-white/5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feed vs 24h Story Switch */}
        <div className="flex gap-2 p-1 rounded-xl bg-[#07080C] border border-white/5">
          <button
            type="button"
            onClick={() => setIsStory(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all border ${
              !isStory
                ? "bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 font-bold shadow-sm"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Post nel Profilo (Vita &amp; Analisi)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsStory(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all border ${
              isStory
                ? "bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 font-bold shadow-sm"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Momento 24h (Storia)</span>
          </button>
        </div>

        {/* Sphere Selector (Vita vs Tempio vs Analisi vs Traguardo) */}
        {!isStory && (
          <div className="space-y-2">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Scegli la Sfera del tuo Post Pubblico
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SPHERE_OPTIONS.map((opt) => {
                const Icon = opt.Icon;
                const active = sphere === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSphere(opt.id)}
                    className={`flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? "border-[#C5A059] bg-[#C5A059]/15 text-white shadow-[0_0_15px_rgba(197,160,89,0.15)]"
                        : "border-white/10 bg-[#12131A]/70 text-slate-400 hover:border-[#C5A059]/35 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          active ? "text-[#E8C56A]" : "text-slate-400"
                        }`}
                      />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                        {opt.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {opt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isStory
              ? "Condividi un momento della tua giornata, la tua postazione o una riflessione..."
              : activeSphereMeta.placeholder
          }
          rows={4}
          maxLength={2000}
          className="w-full px-3.5 py-3 bg-[#12131A] border border-[#C5A059]/25 rounded-xl text-sm text-white focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 resize-none transition-all placeholder:text-slate-500 font-sans"
          autoFocus
        />

        {/* Optional Protocol Seal (Available for Analisi or if user wants to add a reflection) */}
        {!isStory && (
          <div className="rounded-xl border border-[#26262E] bg-[#0A0A0C]/80 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#C5A059]">
                Opzionale: Sigillo di Disciplina &amp; Riflessione
              </span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachProtocolReport}
                  onChange={(e) => setAttachProtocolReport(e.target.checked)}
                  className="accent-[#C5A059]"
                />
                Aggiungi Sigillo
              </label>
            </div>

            {attachProtocolReport && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustodeStatus("INTEGRITA_100")}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      custodeStatus === "INTEGRITA_100"
                        ? "border-[#C5A059] bg-[#C5A059]/15 text-[#F4F4F6]"
                        : "border-border text-muted-foreground hover:border-[#C5A059]/40"
                    }`}
                  >
                    <span className="block font-mono text-[10px] uppercase text-[#C5A059]">
                      Stato Personale
                    </span>
                    <span className="font-medium">Lucidità 100% · In Regola</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustodeStatus("REVISIONE")}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      custodeStatus === "REVISIONE"
                        ? "border-[#8B1E1E] bg-[#8B1E1E]/20 text-[#F4F4F6]"
                        : "border-border text-muted-foreground hover:border-[#8B1E1E]/40"
                    }`}
                  >
                    <span className="block font-mono text-[10px] uppercase text-[#d86b6b]">
                      Autocritica
                    </span>
                    <span className="font-medium">Riflessione / Correzione</span>
                  </button>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Massima o Lezione Personale
                  </label>
                  <input
                    type="text"
                    value={libroLesson}
                    onChange={(e) => setLibroLesson(e.target.value)}
                    placeholder="Es: La costanza fuori dai mercati costruisce la lucidità sui grafici."
                    maxLength={240}
                    className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden border border-[#C5A059]/25 bg-[#06070A]">
            <img
              src={imageUrl}
              alt="preview"
              className="w-full max-h-64 object-contain"
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full text-white hover:bg-black transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showEmoji && <EmojiPickerPanel onSelect={insertEmoji} />}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading || !!imageUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C5A059]/25 bg-[#12131A] text-xs text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059]/50 transition-colors disabled:opacity-40"
              title={uiText("auto.ui.5d4e2a46f6")}
            >
              {imageUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#C5A059]" />
              )}
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Allega Foto / Grafico
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              className={`p-2 rounded-lg transition-colors ${
                showEmoji
                  ? "text-[#E8C56A] bg-[#C5A059]/15"
                  : "text-slate-400 hover:text-[#E8C56A] hover:bg-[#C5A059]/10"
              }`}
              title={uiText("auto.ui.5090a9e78c")}
            >
              <Smile className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-slate-500 ml-1">
              {content.length}/2000
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              (!content.trim() && !libroLesson.trim() && !imageUrl) ||
              createPost.isPending
            }
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black rounded-xl font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-[#C5A059]/20"
          >
            {createPost.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Send className="w-4 h-4 text-black" />
            )}
            <span>Pubblica nel Profilo</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {isStory && (
          <p className="text-xs flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Il momento rimarrà visibile nel tuo profilo pubblico per 24 ore
          </p>
        )}
      </motion.div>
    </div>
  );
}
