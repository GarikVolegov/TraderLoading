import { useAuth } from "@clerk/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Image as ImageIcon, Tag, Plus, Star, Hash, ClipboardCheck, Target, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useUploadJournalImage,
  useDeleteJournalImage,
  getGetJournalEntriesQueryKey,
  getGetJournalEdgeQueryKey,
  useGetChecklist,
  type JournalEntry
} from "@workspace/api-client-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { fetchJournalTags, journalTagsQueryKey, saveJournalTag, type JournalTagSummary } from "@/lib/journalTagsApi";
import { trackEvent } from "@/lib/analytics";
import { addProcessEvidence, fetchTraderProcess, traderProcessKey } from "@/lib/traderProcessApi";
import { processDateTimeInput, parseProcessDateTime } from "@/lib/processDateTime";
import { processDay } from "../../../../contracts/trader-process";
import { journeyText } from "@/lib/processJourneyCopy";
import { processText } from "@/lib/processCopy";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: JournalEntry | null;
  initialPair?: string;
  marketDecisionId?: string;
  processSessionId?: string;
  methodVersionId?: string;
}

// ─── Saved tags hook ──────────────────────────────────────────────────────────

function useSavedTags() {
  return useQuery<JournalTagSummary[]>({
    queryKey: journalTagsQueryKey,
    queryFn: () => fetchJournalTags(),
    staleTime: 30_000,
  });
}

// ─── SmartTagInput ────────────────────────────────────────────────────────────

interface SmartTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  onSaveTag?: (tag: string) => void;
  savedTags: { tag: string; count: number }[];
}

function SmartTagInput({ value, onChange, onSaveTag, savedTags }: SmartTagInputProps) {
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
    onSaveTag?.(t);
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
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.4a76dcb4c0")}</span>
                </div>
              )}
              {suggestions.map((s) => (
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

export function JournalEntryModal({ isOpen, onClose, entry, initialPair, marketDecisionId, processSessionId, methodVersionId }: JournalEntryModalProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const copy = (key: Parameters<typeof processText>[1]) => processText(language, key);
  const queryClient = useQueryClient();
  const processContext = Boolean(!entry && processSessionId && methodVersionId);
  const { userId, isLoaded, isSignedIn } = useAuth();
  const processQuery = useQuery({ queryKey: [...traderProcessKey, userId], queryFn: fetchTraderProcess, enabled: processContext && isOpen && isLoaded && isSignedIn === true && Boolean(userId) });
  const contextSession = processQuery.data?.session?.id === processSessionId ? processQuery.data?.session ?? null : null;

  // All 4 are driven via mutateAsync inside handleSave's own try/catch (which
  // already shows a "journal_modal.error" toast below) — suppressGlobalError
  // opts them out of App.tsx's global MutationCache toast to avoid a double toast.
  const suppressGlobalErrorMeta = { mutation: { meta: { suppressGlobalError: true } } };
  const createMutation = useCreateJournalEntry(suppressGlobalErrorMeta);
  const updateMutation = useUpdateJournalEntry(suppressGlobalErrorMeta);
  const uploadImageMutation = useUploadJournalImage(suppressGlobalErrorMeta);
  const deleteImageMutation = useDeleteJournalImage(suppressGlobalErrorMeta);
  const { data: savedTagsData = [] } = useSavedTags();
  const saveTagMutation = useMutation({
    mutationFn: (tag: string) => saveJournalTag(tag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: journalTagsQueryKey }),
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tradeDate, setTradeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [result, setResult] = useState<"win" | "loss" | "breakeven" | "none">("none");
  const [tagList, setTagList] = useState<string[]>([]);

  const [existingImages, setExistingImages] = useState<{id: number, url: string}[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
  const [pendingFiles, setPendingFiles] = useState<(File & { preview: string })[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const pendingFilesRef = useRef(pendingFiles);
  // Optional structured trade → feeds the coach (finding 3.5). Kept as strings for
  // controlled inputs; only sent when complete, so a plain-text edit never touches
  // an existing trade (the backend guard ignores a body without trade fields).
  const [executionEnvironment, setExecutionEnvironment] = useState<"simulation" | "real" | "unknown" | "">("");
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [profit, setProfit] = useState("");
  const [initialRisk, setInitialRisk] = useState("");
  const [costs, setCosts] = useState("");
  const [adherence, setAdherence] = useState<"conforming" | "violation" | "unknown">("unknown");
  const [processNote, setProcessNote] = useState("");
  const [currency, setCurrency] = useState("");
  const [processOpenTime, setProcessOpenTime] = useState("");
  const [processCloseTime, setProcessCloseTime] = useState("");
  const timeDefaults = useRef({ input: "", iso: "" });
  const evidenceRequestId = useRef(crypto.randomUUID());
  const evidenceSaved = useRef(false);
  const linkedTradeId = useRef<number | undefined>(undefined);

  const savedEntryId = useRef<number | undefined>(undefined);
  const saving = useRef(false);
  useEffect(() => {
    pendingFilesRef.current.forEach(file => URL.revokeObjectURL(file.preview));
    savedEntryId.current = entry?.id;
    evidenceSaved.current = false;
    linkedTradeId.current = undefined;
    evidenceRequestId.current = crypto.randomUUID();
    setInitialRisk(""); setCosts(""); setAdherence("unknown"); setProcessNote(""); setCurrency("");
    const opened = new Date();
    timeDefaults.current = { input: processDateTimeInput(opened, true), iso: opened.toISOString() };
    setProcessOpenTime(timeDefaults.current.input); setProcessCloseTime(timeDefaults.current.input);
    const trade = entry?.manualTrade;
    setExecutionEnvironment(trade?.executionEnvironment ?? "");
    setSymbol(trade?.symbol ?? initialPair ?? "");
    setDirection(trade?.direction ?? "buy");
    setEntryPrice(trade ? String(trade.entryPrice) : "");
    setExitPrice(trade ? String(trade.exitPrice) : "");
    setStopLoss(trade?.stopLoss != null ? String(trade.stopLoss) : "");
    setProfit(trade ? String(trade.profit) : "");
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTradeDate(entry.tradeDate);
      setResult(entry.result);
      setTagList(entry.tags ? entry.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
      setExistingImages(entry.images || []);
      setPendingDeletes([]);
      setPendingFiles([]);
    } else {
      setTitle("");
      setContent("");
      setTradeDate(processDay());
      setResult("none");
      setTagList([]);
      setExistingImages([]);
      setPendingDeletes([]);
      setPendingFiles([]);
    }
  }, [entry, isOpen, initialPair]);

  useEffect(() => {
    if (!isOpen || !contextSession) return;
    setTitle(current => current || `${contextSession.plan?.market ?? initialPair ?? ""} · ${contextSession.plan?.setup ?? ""}`.trim());
    setInitialRisk(current => current || (contextSession.plan?.initialRisk != null ? String(contextSession.plan.initialRisk) : ""));
    setCurrency(current => current || contextSession.rulesSnapshot.currency);
    setSymbol(current => current || contextSession.plan?.market || "");
    setExecutionEnvironment(current => current || (contextSession.mode === "application" ? "real" : "simulation"));
  }, [contextSession, initialPair, isOpen]);

  const operativePlanData = (() => {
    if (!isOpen || Boolean(entry)) return null;
    const pair = symbol || initialPair;
    if (!pair) return null;
    try {
      const raw = localStorage.getItem(`tl_cockpit_operative_plan_${pair}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.entryPrice || parsed.setupName || parsed.stopLoss) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  })();

  const handleImportOperativePlan = () => {
    if (!operativePlanData) return;
    if (operativePlanData.asset) setSymbol(operativePlanData.asset);
    if (operativePlanData.bias) setDirection(operativePlanData.bias === "short" ? "sell" : "buy");
    if (operativePlanData.entryPrice) setEntryPrice(operativePlanData.entryPrice);
    if (operativePlanData.stopLoss) setStopLoss(operativePlanData.stopLoss);
    if (operativePlanData.riskAmount) setInitialRisk(operativePlanData.riskAmount.replace(/[^0-9.]/g, ""));
    if (operativePlanData.setupName) setTitle(prev => prev || operativePlanData.setupName);
    if (operativePlanData.notes) setContent(prev => prev ? `${prev}\n\n${operativePlanData.notes}` : operativePlanData.notes);
    if (!executionEnvironment) setExecutionEnvironment("real");
    toast({
      title: "Piano Operativo Importato",
      description: `Asset ${operativePlanData.asset}, Entry e Stop Loss caricati con successo nel trade.`,
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] },
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

  const addTagFromPanel = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized || tagList.includes(normalized)) return;
    setTagList(prev => [...prev, normalized]);
    saveTagMutation.mutate(normalized);
  };

  const handleSave = async () => {
    if (saving.current) return;
    if (!title.trim()) {
      toast({ title: t("common.error"), description: t("journal_modal.title_required"), variant: "destructive" });
      return;
    }

    saving.current = true;
    setIsSaving(true);
    try {
      let entryId = savedEntryId.current;
      const tagsString = tagList.length > 0 ? tagList.join(", ") : null;
      // Only attach the trade when the essentials are present; otherwise send no
      // trade fields at all so the backend leaves any existing linked trade alone.
      const tradeComplete =
        symbol.trim() !== "" && entryPrice.trim() !== "" && exitPrice.trim() !== "" && profit.trim() !== "";
      const tradeStarted = [entryPrice, exitPrice, stopLoss, profit].some(value => value.trim() !== "");
      if (processContext && (!contextSession || contextSession.methodVersionId !== methodVersionId || contextSession.state !== "operation")) throw new Error(copy("processUnavailable"));
      const actualOpenTime = processContext ? (processOpenTime === timeDefaults.current.input ? timeDefaults.current.iso : parseProcessDateTime(processOpenTime)) : undefined;
      const actualCloseTime = processContext ? (processCloseTime === timeDefaults.current.input ? timeDefaults.current.iso : parseProcessDateTime(processCloseTime)) : undefined;
      if (actualOpenTime && actualCloseTime && actualCloseTime < actualOpenTime) throw new Error(copy("closeTime"));
      if (tradeComplete && !executionEnvironment) throw new Error(journeyText(language, "environment"));
      if (tradeStarted && !tradeComplete) throw new Error(t("journal_modal.trade_incomplete"));
      if (processContext && !tradeComplete) throw new Error("Completa i dati dell'operazione per collegarla alla sessione.");
      if (initialRisk && (!Number.isFinite(Number(initialRisk)) || Number(initialRisk) <= 0)) throw new Error("Il rischio monetario iniziale deve essere positivo.");
      if (costs && (!Number.isFinite(Number(costs)) || Number(costs) < 0)) throw new Error("Indica costi totali non negativi, oppure lascia il campo vuoto se sconosciuti.");
      const tradeFields = tradeComplete
        ? {
            symbol: symbol.trim(),
            executionEnvironment: executionEnvironment || "unknown",
            direction,
            entryPrice: Number(entryPrice),
            exitPrice: Number(exitPrice),
            stopLoss: stopLoss.trim() !== "" ? Number(stopLoss) : null,
            profit: Number(profit),
            ...(processContext && costs.trim() !== "" ? { commission: -Number(costs), swap: 0 } : {}),
            ...(processContext ? { openTime: actualOpenTime, closeTime: actualCloseTime } : {}),
          }
        : {};
      const formData = { title, content, tradeDate, result, tags: tagsString, ...tradeFields, ...(!entry && marketDecisionId ? { marketDecisionId } : {}) };

      if (!entryId) {
        const newEntry = await createMutation.mutateAsync({ data: formData });
        entryId = newEntry.id;
        savedEntryId.current = entryId;
        linkedTradeId.current = newEntry.manualTrade?.accountTradeId;
        trackEvent("journal_entry_created", { has_result: result ? 1 : 0 });
      } else {
        const updated = await updateMutation.mutateAsync({ id: entryId, data: formData });
        linkedTradeId.current = updated.manualTrade?.accountTradeId;
      }

      if (processContext && !evidenceSaved.current && methodVersionId && processSessionId) {
        if (!linkedTradeId.current) throw new Error("L'operazione è salvata. Il collegamento al processo richiede un nuovo tentativo.");
        await addProcessEvidence({
          methodVersionId, sessionId: processSessionId, accountTradeId: linkedTradeId.current,
          purpose: contextSession?.mode === "practice" ? "development" : contextSession?.mode === "validation" ? "validation" : "live", source: "account_trade", requestId: evidenceRequestId.current,
          initialRisk: initialRisk.trim() ? Number(initialRisk) : null,
          netPnl: costs.trim() ? Number(profit) - Number(costs) : null,
          costsStatus: costs.trim() ? "included" : "unknown", currency: currency || null,
          observedAt: actualCloseTime!,
          adherence, provenance: "declared", note: processNote,
        });
        evidenceSaved.current = true;
        queryClient.invalidateQueries({ queryKey: traderProcessKey });
      }

      for (const imageId of pendingDeletes) {
        await deleteImageMutation.mutateAsync({ id: entryId, imageId });
        setPendingDeletes(previous => previous.filter(id => id !== imageId));
      }

      for (const file of pendingFiles) {
        await uploadImageMutation.mutateAsync({
          id: entryId,
          data: { image: file }
        });
        URL.revokeObjectURL(file.preview);
        setPendingFiles(previous => previous.filter(pending => pending !== file));
      }

      toast({ title: t("common.success"), description: t("journal_modal.saved") });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJournalEdgeQueryKey() });
      queryClient.invalidateQueries({ queryKey: journalTagsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["market-decisions"] });
      onClose();
    } catch (err) {
      toast({
        title: t("journal_modal.error"),
        description: (err instanceof Error && err.message) || t("common.error"),
        variant: "destructive"
      });
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  useEffect(() => { pendingFilesRef.current = pendingFiles; }, [pendingFiles]);
  useEffect(() => () => pendingFilesRef.current.forEach(file => URL.revokeObjectURL(file.preview)), []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-border max-h-[90vh] overflow-y-auto hide-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono text-foreground flex items-center gap-2">
            {entry ? t("journal_modal.edit") : t("journal_modal.new")}
          </DialogTitle>
        </DialogHeader>
        {!entry && marketDecisionId && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">{t("intelligence.linked_note")}</p>}
        {processContext && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-sm">
          <p className="font-medium">{copy("processEvidence")}</p>
          <p className="text-muted-foreground">{copy("outsidePlan")}</p>
          {contextSession?.plan && <p className="text-muted-foreground">Piano: {contextSession.plan.decision === "wait" ? `attesa · ${contextSession.plan.waitReason}` : `${contextSession.plan.market} · ${contextSession.plan.setup}`}</p>}
        </div>}

        {operativePlanData && !entry && (
          <div className="p-3 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-[#1a1c26] to-[#0e1017] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                <Target size={16} />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">
                    Piano Operativo Rilevato · {operativePlanData.asset}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                    operativePlanData.bias === "short" ? "text-rose-400 bg-rose-500/10" : "text-emerald-400 bg-emerald-500/10"
                  }`}>
                    {operativePlanData.bias}
                  </span>
                </div>
                <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                  {operativePlanData.setupName && <strong className="text-foreground mr-1.5">{operativePlanData.setupName} ·</strong>}
                  {operativePlanData.entryPrice && <span>Entry: <strong className="text-primary">{operativePlanData.entryPrice}</strong> </span>}
                  {operativePlanData.stopLoss && <span>· SL: <strong className="text-rose-400">{operativePlanData.stopLoss}</strong> </span>}
                  {operativePlanData.riskAmount && <span>· Rischio: <strong className="text-foreground">{operativePlanData.riskAmount}</strong></span>}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleImportOperativePlan}
              className="text-xs font-mono px-3.5 py-1.5 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow cursor-pointer shrink-0 self-start sm:self-center"
            >
              <Zap size={13} />
              <span>⚡ Importa nel Trade</span>
            </button>
          </div>
        )}

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("journal_modal.date")}</Label>
              <Input
                type="date"
                aria-label={t("journal_modal.date")}
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

          {processContext && <fieldset className="space-y-3 rounded-xl border border-primary/20 p-3">
            <legend className="px-1 text-sm font-medium">{copy("processEvidence")}</legend>
            <p className="text-xs text-muted-foreground">{copy("grossHint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-xs">{copy("initialRisk")}<Input type="number" min="0" step="any" value={initialRisk} onChange={event => setInitialRisk(event.target.value)} /></label>
              <label className="space-y-1 text-xs">{copy("totalCosts")}<Input type="number" min="0" step="any" value={costs} onChange={event => setCosts(event.target.value)} /></label>
              <label className="space-y-1 text-xs">{copy("currency")}<Input value={currency} maxLength={3} onChange={event => setCurrency(event.target.value.toUpperCase())} /></label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="space-y-1 text-xs">{copy("openTime")}<Input type="datetime-local" step="1" value={processOpenTime} onChange={event => setProcessOpenTime(event.target.value)} /></label><label className="space-y-1 text-xs">{copy("closeTime")}<Input type="datetime-local" step="1" value={processCloseTime} onChange={event => setProcessCloseTime(event.target.value)} /></label></div>
            <label className="block space-y-1 text-xs">{copy("adherence")} · {copy("declared")}<select aria-label={`${copy("adherence")} · ${copy("declared")}`} value={adherence} onChange={event => setAdherence(event.target.value as typeof adherence)} className="w-full rounded-md border border-border bg-background p-2 text-base min-h-11">
              <option value="unknown">{copy("unknown")}</option><option value="conforming">{copy("conforming")}</option><option value="violation">{copy("violation")}</option>
            </select></label>
            <label className="block space-y-1 text-xs">{copy("evidenceNote")}<Textarea value={processNote} onChange={event => setProcessNote(event.target.value)} rows={2} /></label>
          </fieldset>}

          <div className="space-y-3 rounded-xl border border-white/10 bg-background/30 p-3">
            <div>
              <Label className="text-muted-foreground">{t("journal_modal.trade.section")}</Label>
              <p className="text-[11px] text-muted-foreground/70">{t("journal_modal.trade.hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trade-execution-environment">{journeyText(language, "environment")}</Label>
              <select id="trade-execution-environment" aria-label={journeyText(language, "environment")}
                value={executionEnvironment} disabled={Boolean(entry?.manualTrade && entry.manualTrade.executionEnvironment !== "unknown")}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base sm:text-sm"
                onChange={event => setExecutionEnvironment(event.target.value as typeof executionEnvironment)}>
                <option value="">—</option>
                {(["simulation", "real", "unknown"] as const).map(value => <option key={value} value={value}>{journeyText(language, value)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.symbol")}</Label>
                <Input
                  aria-label={t("journal_modal.trade.symbol")}
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="bg-background/50 border-white/10 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.direction")}</Label>
                <div className="flex bg-background/50 p-1 rounded-lg border border-white/10">
                  {(['buy', 'sell'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={`flex-1 text-xs py-1 rounded-md font-medium transition-all ${
                        direction === d
                          ? d === 'buy' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                          : 'text-muted-foreground hover:bg-white/5'
                      }`}
                    >
                      {d === 'buy' ? 'Buy' : 'Sell'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.profit")}</Label>
                <Input type="number" inputMode="decimal" aria-label={t("journal_modal.trade.profit")} value={profit} onChange={e => setProfit(e.target.value)} className="bg-background/50 border-white/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.entry")}</Label>
                <Input type="number" inputMode="decimal" aria-label={t("journal_modal.trade.entry")} value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className="bg-background/50 border-white/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.exit")}</Label>
                <Input type="number" inputMode="decimal" aria-label={t("journal_modal.trade.exit")} value={exitPrice} onChange={e => setExitPrice(e.target.value)} className="bg-background/50 border-white/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("journal_modal.trade.stop")}</Label>
                <Input type="number" inputMode="decimal" aria-label={t("journal_modal.trade.stop")} value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="bg-background/50 border-white/10" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("journal_modal.title_label")}</Label>
            <Input
              aria-label={t("journal_modal.title_label")}
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
              <span className="text-xs opacity-40 font-normal ml-1">{uiText("auto.ui.ae9109b789")}</span>
            </Label>
            <SmartTagInput
              value={tagList}
              onChange={setTagList}
              onSaveTag={(tag) => saveTagMutation.mutate(tag)}
              savedTags={savedTagsData}
            />
            {!processContext && <ChecklistTagPanel
              activeTags={tagList}
              onAdd={addTagFromPanel}
            />}
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
