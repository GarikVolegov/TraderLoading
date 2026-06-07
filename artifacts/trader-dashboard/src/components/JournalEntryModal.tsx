import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Image as ImageIcon, Tag, Plus, Star, Hash, ClipboardCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useUploadJournalImage,
  useDeleteJournalImage,
  getGetJournalEntriesQueryKey,
  useGetChecklist,
  type JournalEntry
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: JournalEntry | null;
}

// ─── Saved tags hook ──────────────────────────────────────────────────────────

function useSavedTags() {
  return useQuery<{ tag: string; count: number }[]>({
    queryKey: ["journal-tags"],
    queryFn: () =>
      fetch("api/journal/tags", { credentials: "include" })
        .then(r => r.ok ? r.json() : []),
    staleTime: 30_000,
  });
}

// ─── SmartTagInput ────────────────────────────────────────────────────────────

interface SmartTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  savedTags: { tag: string; count: number }[];
}

function SmartTagInput({ value, onChange, savedTags }: SmartTagInputProps) {
  const [inputVal, setInputVal] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = inputVal.trim().toLowerCase();

  const suggestions = savedTags.filter(s =>
    !value.includes(s.tag) &&
    (query === "" || s.tag.toLowerCase().includes(query))
  );

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setInputVal("");
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputVal.trim()) {
      e.preventDefault();
      addTag(inputVal.replace(/,$/, ""));
    } else if (e.key === "Backspace" && !inputVal && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const frequentTags = savedTags.filter(s => !value.includes(s.tag)).slice(0, 12);

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected tag chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {value.map(tag => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/15 border border-primary/30 text-primary rounded-lg text-xs font-medium"
              >
                <Hash className="w-3 h-3 opacity-70" />
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-destructive transition-colors rounded-full p-0.5 hover:bg-destructive/10"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Input with dropdown */}
      <div className="relative">
        <div
          className="flex items-center gap-2 bg-background/50 border border-white/10 rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors cursor-text"
          onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        >
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder={value.length === 0 ? "Aggiungi tag... (Invio o virgola per confermare)" : "Aggiungi altro..."}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40 min-w-0"
          />
          {inputVal.trim() && (
            <button
              type="button"
              onClick={() => addTag(inputVal)}
              className="shrink-0 text-xs text-primary hover:text-primary/80 font-medium"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown suggestions */}
        <AnimatePresence>
          {open && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
            >
              {query === "" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/50">
                  <Star className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tag usati di frequente</span>
                </div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={s.tag}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); addTag(s.tag); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/60 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium">{s.tag}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 bg-secondary/80 px-1.5 py-0.5 rounded-md font-mono">
                    ×{s.count}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick-select frequent tags (when input is empty and no dropdown is needed) */}
      {!open && frequentTags.length > 0 && value.length < frequentTags.length && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400" /> Seleziona dai tuoi tag
          </p>
          <div className="flex flex-wrap gap-1.5">
            {frequentTags.slice(0, 10).filter(s => !value.includes(s.tag)).map(s => (
              <button
                key={s.tag}
                type="button"
                onClick={() => addTag(s.tag)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/40 border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 rounded-lg text-xs font-medium transition-all"
              >
                <Hash className="w-2.5 h-2.5 opacity-60" />
                {s.tag}
                <span className="text-[9px] opacity-50 font-mono ml-0.5">×{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChecklistTagPanel ────────────────────────────────────────────────────────

interface ChecklistTagPanelProps {
  activeTags: string[];
  onAdd: (tag: string) => void;
}

function ChecklistTagPanel({ activeTags, onAdd }: ChecklistTagPanelProps) {
  const { data: items } = useGetChecklist();
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/30">
      <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <ClipboardCheck className="w-3 h-3 text-primary" />
        Importa dalla Checklist Pre-Trade
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => {
          const isActive = activeTags.includes(item.text);
          return (
            <button
              key={item.id}
              type="button"
              disabled={isActive}
              onClick={() => onAdd(item.text)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? "bg-primary/15 border-primary/40 text-primary cursor-default opacity-70"
                  : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              }`}
            >
              <ClipboardCheck className="w-2.5 h-2.5 opacity-60" />
              {item.text}
              {isActive && <span className="text-[9px] ml-0.5 opacity-60">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function JournalEntryModal({ isOpen, onClose, entry }: JournalEntryModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const uploadImageMutation = useUploadJournalImage();
  const deleteImageMutation = useDeleteJournalImage();
  const { data: savedTagsData = [] } = useSavedTags();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tradeDate, setTradeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [result, setResult] = useState<"win" | "loss" | "breakeven" | "none">("none");
  const [tagList, setTagList] = useState<string[]>([]);

  const [existingImages, setExistingImages] = useState<{id: number, url: string}[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
  const [pendingFiles, setPendingFiles] = useState<(File & { preview: string })[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTradeDate(entry.tradeDate);
      setResult(entry.result as any);
      setTagList(entry.tags ? entry.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
      setExistingImages(entry.images || []);
      setPendingDeletes([]);
      setPendingFiles([]);
    } else {
      setTitle("");
      setContent("");
      setTradeDate(format(new Date(), "yyyy-MM-dd"));
      setResult("none");
      setTagList([]);
      setExistingImages([]);
      setPendingDeletes([]);
      setPendingFiles([]);
    }
  }, [entry, isOpen]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 5 * 1024 * 1024
  });

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const removeExistingImage = (imageId: number) => {
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
    setPendingDeletes(prev => [...prev, imageId]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: t("common.error"), description: t("journal_modal.title_required"), variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let entryId = entry?.id;
      const tagsString = tagList.length > 0 ? tagList.join(", ") : null;
      const formData = { title, content, tradeDate, result, tags: tagsString };

      if (!entryId) {
        const newEntry = await createMutation.mutateAsync({ data: formData });
        entryId = newEntry.id;
      } else {
        await updateMutation.mutateAsync({ id: entryId, data: formData });
      }

      for (const imageId of pendingDeletes) {
        await deleteImageMutation.mutateAsync({ id: entryId, imageId });
      }

      for (const file of pendingFiles) {
        await uploadImageMutation.mutateAsync({
          id: entryId,
          data: { image: file as any }
        });
      }

      toast({ title: t("common.success"), description: t("journal_modal.saved") });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["journal-tags"] });
      onClose();
    } catch (err: any) {
      toast({
        title: t("journal_modal.error"),
        description: err.message || t("common.error"),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    return () => pendingFiles.forEach(file => URL.revokeObjectURL(file.preview));
  }, [pendingFiles]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-border max-h-[90vh] overflow-y-auto hide-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono text-foreground flex items-center gap-2">
            {entry ? t("journal_modal.edit") : t("journal_modal.new")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("journal_modal.date")}</Label>
              <Input
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                className="bg-background/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("journal_modal.result")}</Label>
              <div className="flex bg-background/50 p-1 rounded-xl border border-white/10">
                {(['win', 'loss', 'breakeven', 'none'] as const).map(res => (
                  <button
                    key={res}
                    onClick={() => setResult(res)}
                    className={`flex-1 text-xs sm:text-sm py-1.5 rounded-lg font-medium transition-all ${
                      result === res
                        ? res === 'win' ? 'bg-success/20 text-success'
                        : res === 'loss' ? 'bg-destructive/20 text-destructive'
                        : res === 'breakeven' ? 'bg-warning/20 text-warning'
                        : 'bg-white/10 text-white'
                        : 'text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    {res === 'win' ? 'Win' : res === 'loss' ? 'Loss' : res === 'breakeven' ? 'BE' : t("journal_modal.result_none")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("journal_modal.title_label")}</Label>
            <Input
              placeholder={t("journal_modal.title_placeholder")}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-background/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              {t("journal_modal.tags_label")}
              <span className="text-xs opacity-40 font-normal ml-1">Invio o , per aggiungere</span>
            </Label>
            <SmartTagInput
              value={tagList}
              onChange={setTagList}
              savedTags={savedTagsData}
            />
            <ChecklistTagPanel
              activeTags={tagList}
              onAdd={(tag) => { if (!tagList.includes(tag)) setTagList(prev => [...prev, tag]); }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("journal_modal.notes_label")}</Label>
            <Textarea
              placeholder={t("journal_modal.notes_placeholder")}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[150px] bg-background/50 border-white/10 resize-y"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-muted-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              {t("journal_modal.images_label")}
            </Label>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-white/10 hover:border-primary/50 hover:bg-white/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-primary' : ''}`} />
                <p className="text-sm font-medium">
                  {isDragActive ? t("journal_modal.drop_active") : t("journal_modal.drop_inactive")}
                </p>
                <p className="text-xs opacity-70">{t("journal_modal.drop_hint")}</p>
              </div>
            </div>

            {(existingImages.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                <AnimatePresence>
                  {existingImages.map((img) => (
                    <motion.div
                      key={`ext-${img.id}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-white/10 bg-background"
                    >
                      <img src={img.url} alt="Journal entry" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}

                  {pendingFiles.map((file, idx) => (
                    <motion.div
                      key={file.preview}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-primary/50 bg-background"
                    >
                      <img src={file.preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 ring-2 ring-inset ring-primary/50 pointer-events-none rounded-lg" />
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {t("journal_modal.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("journal_modal.saving")}</>
            ) : (
              t("journal_modal.save")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
