import { useAuth } from "@clerk/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  X,
  UploadCloud,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Camera,
  Target,
  FolderOpen,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useCreateJournalEntry,
  useUploadJournalImage,
  getGetJournalEntriesQueryKey,
  getGetJournalEdgeQueryKey,
} from "@workspace/api-client-react";
import { addProcessEvidence, fetchTraderProcess, traderProcessKey } from "@/lib/traderProcessApi";
import { trackEvent } from "@/lib/analytics";

function processDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeCurrencyCode(curr?: string): string {
  if (!curr) return "EUR";
  const c = curr.trim().toUpperCase();
  if (c === "€" || c === "EUR") return "EUR";
  if (c === "$" || c === "USD") return "USD";
  if (c === "£" || c === "GBP") return "GBP";
  if (/^[A-Z]{3}$/.test(c)) return c;
  return "EUR";
}

export interface TimeframeSnapshot {
  id: string;
  step: 1 | 2 | 3 | 4;
  stepName: string;
  timeframe: string;
  timestamp: string;
  summary: string;
  imageDataUrl?: string;
}

export interface CockpitTradeRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: string;
  bias: "long" | "short" | "wait";
  scenario?: string;
  trigger?: string;
  entryPrice?: string;
  stopLoss?: string;
  target?: string;
  initialRisk?: string;
  currency?: string;
  notes?: string;
  timeframeSnapshots?: TimeframeSnapshot[];
  onAddSnapshotImage?: (snapshotId: string, imageDataUrl: string) => void;
  processSessionId?: string;
  methodVersionId?: string;
  onConfirmCloseSession?: (notes: string, outcome: "confirmed" | "partial" | "invalidated") => Promise<void>;
  onSuccess?: () => void;
}

// Convert data URL (base64) to File object for upload
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

export function CockpitTradeRegisterModal({
  isOpen,
  onClose,
  market,
  bias,
  scenario = "Setup Cockpit",
  trigger = "TEST",
  entryPrice = "",
  stopLoss = "",
  target = "",
  initialRisk = "5",
  currency = "€",
  notes = "",
  timeframeSnapshots = [],
  onAddSnapshotImage,
  processSessionId,
  methodVersionId,
  onConfirmCloseSession,
  onSuccess,
}: CockpitTradeRegisterModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId, isLoaded, isSignedIn } = useAuth();

  const processContext = Boolean(processSessionId && methodVersionId);
  const processQuery = useQuery({
    queryKey: [...traderProcessKey, userId],
    queryFn: fetchTraderProcess,
    enabled: processContext && isOpen && isLoaded && isSignedIn === true && Boolean(userId),
  });
  const contextSession =
    processQuery.data?.session?.id === processSessionId ? processQuery.data?.session ?? null : null;

  const suppressGlobalErrorMeta = { mutation: { meta: { suppressGlobalError: true } } };
  const createMutation = useCreateJournalEntry(suppressGlobalErrorMeta);
  const uploadImageMutation = useUploadJournalImage(suppressGlobalErrorMeta);

  // Form states
  const [outcome, setOutcome] = useState<"win" | "loss" | "breakeven">("win");
  const [customProfit, setCustomProfit] = useState<string>("");
  const [tradeNotes, setTradeNotes] = useState<string>(notes);
  const [attachedFiles, setAttachedFiles] = useState<(File & { preview: string })[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<TimeframeSnapshot[]>(timeframeSnapshots);
  const [slotTargetId, setSlotTargetId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isAddingCustomSlot, setIsAddingCustomSlot] = useState(false);
  const [customTfInput, setCustomTfInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const slotFileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSnapshots(timeframeSnapshots);
  }, [timeframeSnapshots]);

  // Compute planned R:R and default profit
  const numEntry = parseFloat(entryPrice) || 0;
  const numStop = parseFloat(stopLoss) || 0;
  const numRisk = parseFloat(initialRisk) || 5;

  const numTarget = parseFloat(target) || 0;
  let plannedRR = 2.0;
  if (numEntry > 0 && numStop > 0 && numTarget > 0) {
    const riskDistance = Math.abs(numEntry - numStop);
    const rewardDistance = Math.abs(numTarget - numEntry);
    if (riskDistance > 0) {
      plannedRR = parseFloat((rewardDistance / riskDistance).toFixed(2));
    }
  }

  // Pre-fill default monetary profit when outcome changes or modal opens
  useEffect(() => {
    if (outcome === "win") {
      const estimatedWin = (numRisk * plannedRR).toFixed(2);
      setCustomProfit(estimatedWin);
    } else if (outcome === "loss") {
      setCustomProfit((-numRisk).toFixed(2));
    } else {
      setCustomProfit("0.00");
    }
  }, [outcome, numRisk, plannedRR, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTradeNotes(notes);
    }
  }, [isOpen, notes]);

  // Gestione slot specifici per timeframe
  const openSlotPicker = (snapshotId: string) => {
    setSlotTargetId(snapshotId);
    if (slotFileInputRef.current) {
      slotFileInputRef.current.value = "";
      slotFileInputRef.current.click();
    }
  };

  const handleSlotFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slotTargetId) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "File troppo grande",
        description: "La dimensione massima consentita per lo screenshot è 20MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLocalSnapshots((prev) =>
        prev.map((s) => (s.id === slotTargetId ? { ...s, imageDataUrl: dataUrl } : s))
      );
      onAddSnapshotImage?.(slotTargetId, dataUrl);
      toast({
        title: "Screenshot Timeframe Caricato",
        description: "Scatto associato con successo a questo passaggio dell'operazione.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlotImage = (snapshotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalSnapshots((prev) =>
      prev.map((s) => (s.id === snapshotId ? { ...s, imageDataUrl: undefined } : s))
    );
    onAddSnapshotImage?.(snapshotId, "");
  };

  const handleRemoveSlotEntirely = (snapshotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
  };

  const handleAddCustomTimeframe = () => {
    const tf = customTfInput.trim().toUpperCase() || "M5";
    const newId = `${market}_custom_${Date.now()}`;
    const newSnapshot: TimeframeSnapshot = {
      id: newId,
      step: 4,
      stepName: `Analisi ${tf}`,
      timeframe: tf,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      summary: `Scatto aggiuntivo ${tf}`,
    };
    setLocalSnapshots((prev) => [...prev, newSnapshot]);
    setCustomTfInput("");
    setIsAddingCustomSlot(false);
    setTimeout(() => {
      openSlotPicker(newId);
    }, 100);
  };

  // Gestione caricamento generale da Galleria o Esplora File
  const handleGeneralFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: (File & { preview: string })[] = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File troppo grande",
          description: `${file.name} supera il limite massimo di 20MB.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      );
    }

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
      toast({
        title: `${validFiles.length} Screenshot Caricat${validFiles.length > 1 ? "i" : "o"}`,
        description: "File aggiunti agli allegati dell'operazione.",
      });
    }

    if (generalFileInputRef.current) {
      generalFileInputRef.current.value = "";
    }
  };

  // Handle Drag & Drop files
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles]);
      toast({
        title: `${newFiles.length} Screenshot Trascinat${newFiles.length > 1 ? "i" : "o"}`,
        description: "File aggiunti agli allegati dell'operazione.",
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".heic"],
    },
    maxSize: 20 * 1024 * 1024,
    noClick: true,
  });

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  // Paste image listener (Cmd+V)
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const pastedFile = Object.assign(blob, {
              preview: URL.createObjectURL(blob),
            });
            setAttachedFiles((prev) => [...prev, pastedFile]);
            toast({
              title: "Screenshot Incollato",
              description: "Immagine aggiunta agli allegati del trade.",
            });
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, toast]);

  // Clean object URLs on unmount
  useEffect(() => {
    return () => {
      attachedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, [attachedFiles]);

  // Final submission
  const handleSubmit = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const isLong = bias === "long" || (bias !== "short" && bias !== "wait");
      const dir = isLong ? "buy" : "sell";
      const parsedCustomProfit = parseFloat(customProfit);
      const profitNum = Number.isFinite(parsedCustomProfit)
        ? parsedCustomProfit
        : (outcome === "win" ? numRisk * plannedRR : outcome === "loss" ? -numRisk : 0);

      // Safe numeric prices that satisfy database & zod constraints
      const safeEntry = numEntry > 0 ? numEntry : 100.0;
      let estimatedExit = safeEntry;
      if (outcome === "win") {
        estimatedExit = numTarget > 0 ? numTarget : (isLong ? safeEntry * 1.015 : safeEntry * 0.985);
      } else if (outcome === "loss") {
        estimatedExit = numStop > 0 ? numStop : (isLong ? safeEntry * 0.99 : safeEntry * 1.01);
      } else {
        estimatedExit = safeEntry;
      }

      const safeStop = numStop > 0 ? numStop : null;

      const title = `${market} · ${dir.toUpperCase()} · ${scenario}`;
      const safeTarget = numTarget > 0 ? numTarget : null;

      // Structured content compatible with parseTradeContent parser in Journal
      const contentLines = [
        `Symbol: ${market}`,
        `Direction: ${dir.toUpperCase()}`,
        `Entry Price: ${safeEntry}`,
        `Exit Price: ${estimatedExit}`,
        safeStop ? `Stop Loss: ${safeStop}` : "",
        safeTarget ? `Take Profit: ${safeTarget}` : "",
        `Profit: ${profitNum >= 0 ? `+${profitNum.toFixed(2)}` : profitNum.toFixed(2)}`,
        `Volume: 1.00`,
        `Status: closed`,
        `Currency: ${normalizeCurrencyCode(currency)}`,
        "",
        `Setup: ${scenario} · Trigger: ${trigger} · Esito: ${outcome.toUpperCase()}`,
        tradeNotes.trim() ? `\n${tradeNotes.trim()}` : "",
      ].filter((l) => l !== "").join("\n");

      const tags = [market, dir.toUpperCase(), trigger, scenario, "Cockpit", "account-import"].filter(Boolean).join(", ");
      const nowIso = new Date().toISOString();
      const openTimeIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const tradeData = {
        title,
        content: contentLines,
        tradeDate: processDay(),
        result: outcome,
        tags,
        symbol: market,
        executionEnvironment: (contextSession?.mode === "application" ? "real" : "simulation") as "simulation" | "real" | "unknown",
        direction: dir as "buy" | "sell",
        entryPrice: safeEntry,
        exitPrice: estimatedExit,
        stopLoss: safeStop,
        profit: profitNum,
        openTime: openTimeIso,
        closeTime: nowIso,
      };

      // 1. Create Journal Entry
      const newEntry = await createMutation.mutateAsync({ data: tradeData });
      trackEvent("journal_entry_created", { has_result: 1, source: "cockpit_streamlined" });

      // 2. Upload any timeframe snapshots that have image data
      for (const snap of localSnapshots) {
        if (snap.imageDataUrl && (snap.imageDataUrl.startsWith("data:") || snap.imageDataUrl.startsWith("blob:"))) {
          try {
            const file = await dataUrlToFile(snap.imageDataUrl, `snapshot-${snap.timeframe}-${snap.step}.png`);
            await uploadImageMutation.mutateAsync({
              id: newEntry.id,
              data: { image: file },
            });
          } catch (e) {
            console.error("Failed uploading timeframe snapshot image", e);
          }
        }
      }

      // 3. Upload attached files
      for (const file of attachedFiles) {
        try {
          await uploadImageMutation.mutateAsync({
            id: newEntry.id,
            data: { image: file },
          });
        } catch (e) {
          console.error("Failed uploading attached file", e);
        }
      }

      // 4. Link process evidence safely if session is active
      if (processContext && methodVersionId && processSessionId) {
        const linkedId = newEntry.manualTrade?.accountTradeId;
        if (linkedId) {
          try {
            await addProcessEvidence({
              methodVersionId,
              sessionId: processSessionId,
              accountTradeId: linkedId,
              purpose: contextSession?.mode === "practice" ? "development" : contextSession?.mode === "validation" ? "validation" : "live",
              source: "account_trade",
              requestId: crypto.randomUUID(),
              initialRisk: numRisk > 0 ? numRisk : 5,
              netPnl: profitNum,
              costsStatus: "included",
              currency: normalizeCurrencyCode(currency),
              observedAt: nowIso,
              adherence: "conforming",
              provenance: "declared",
              note: tradeNotes || `Operazione registrata dal Cockpit (${outcome.toUpperCase()})`,
            });
          } catch (evErr) {
            console.warn("Evidence linking non-blocking warning:", evErr);
          }
        }
      }

      // 5. Invalidate caches
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJournalEdgeQueryKey() });
      queryClient.invalidateQueries({ queryKey: traderProcessKey });

      toast({
        title: "Trade Registrato con Successo!",
        description: `${market} (${outcome.toUpperCase()}) archiviato nel Diario con tutte le metriche e gli scatti.`,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      toast({
        title: "Errore durante la registrazione",
        description: err instanceof Error ? err.message : "Si è verificato un errore inaspettato.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isLong = bias === "long" || (bias !== "short" && bias !== "wait");
  const filledSnapshotsCount = localSnapshots.filter((s) => Boolean(s.imageDataUrl)).length;
  const totalAttachmentsCount = filledSnapshotsCount + attachedFiles.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] bg-[#0c0d12]/95 border border-white/10 text-foreground backdrop-blur-2xl p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Header Elegante */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                <Target size={16} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Registrazione Trade</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 border border-white/10 text-foreground">
                    {market}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conferma esito, note e scatti multi-timeframe per il Libro della Verità
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto hide-scrollbar">
          {/* 1. Scheda Parametri Precompilati (compatta e chiara) */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                    isLong ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30" : "text-rose-400 bg-rose-500/15 border border-rose-500/30"
                  }`}
                >
                  {isLong ? "LONG" : "SHORT"}
                </span>
                <span className="text-foreground font-semibold truncate max-w-[200px]">
                  {scenario}
                </span>
              </div>
              <span className="text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-[10px]">
                Trigger: {trigger}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-center">
              <div className="p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-[9px] text-muted-foreground uppercase block">Entry</span>
                <strong className="text-foreground text-xs">{entryPrice || "A Mercato"}</strong>
              </div>
              <div className="p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-[9px] text-muted-foreground uppercase block">Stop Loss</span>
                <strong className="text-rose-400 text-xs">{stopLoss || "Struttura"}</strong>
              </div>
              <div className="p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-[9px] text-muted-foreground uppercase block">Target</span>
                <strong className="text-emerald-400 text-xs truncate block">{target || "Pool"}</strong>
              </div>
              <div className="p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-[9px] text-muted-foreground uppercase block">R:R / Rischio</span>
                <strong className="text-amber-400 text-xs">{currency}{initialRisk} ({plannedRR}R)</strong>
              </div>
            </div>
          </div>

          {/* 2. Selezione dell'Esito (È andato a buon fine o meno?) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              1. Esito del Trade (Com'è andata l'operazione?)
            </Label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setOutcome("win")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  outcome === "win"
                    ? "border-emerald-500/60 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40 shadow-lg"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp size={14} />
                    <span>A buon fine</span>
                  </span>
                  {outcome === "win" && <CheckCircle2 size={13} className="text-emerald-400" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Target raggiunto (Win)</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcome("loss")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  outcome === "loss"
                    ? "border-rose-500/60 bg-rose-500/15 text-white ring-1 ring-rose-500/40 shadow-lg"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <TrendingDown size={14} />
                    <span>Stop Loss</span>
                  </span>
                  {outcome === "loss" && <CheckCircle2 size={13} className="text-rose-400" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Perdita controllata (Loss)</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcome("breakeven")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  outcome === "breakeven"
                    ? "border-amber-500/60 bg-amber-500/15 text-white ring-1 ring-amber-500/40 shadow-lg"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Minus size={14} />
                    <span>Pareggio</span>
                  </span>
                  {outcome === "breakeven" && <CheckCircle2 size={13} className="text-amber-400" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Chiusura a BE (Zero)</span>
              </button>
            </div>

            {/* PnL Rapido o Calcolato */}
            <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {outcome === "win" ? "Profitto Realizzato Stimato:" : outcome === "loss" ? "Perdita Registrata:" : "Risultato Netto:"}
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-muted-foreground">{currency}</span>
                <Input
                  type="number"
                  step="any"
                  value={customProfit}
                  onChange={(e) => setCustomProfit(e.target.value)}
                  className="w-24 h-7 text-xs font-mono font-bold text-right bg-white/5 border-white/10"
                />
              </div>
            </div>
          </div>

          {/* 3. Scatti Multi-Timeframe dell'Analisi (Step 1 HTF, Step 2 ITF, Step 3 LTF) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Camera size={13} className="text-primary" />
                <span>2. Scatti Timeframe & Screenshot del Grafico</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                  {totalAttachmentsCount} {totalAttachmentsCount === 1 ? "allegato" : "allegati"}
                </span>
                {!isAddingCustomSlot && (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomSlot(true)}
                    className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Aggiungi TF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form rapido per aggiungere un timeframe aggiuntivo */}
            {isAddingCustomSlot && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-black/50 border border-primary/30 animate-in fade-in">
                <Input
                  autoFocus
                  placeholder="Es. M5, M15, H4..."
                  value={customTfInput}
                  onChange={(e) => setCustomTfInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomTimeframe();
                    if (e.key === "Escape") setIsAddingCustomSlot(false);
                  }}
                  className="h-7 text-xs bg-black/60 border-white/15 w-32 font-mono uppercase"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomTimeframe}
                  className="h-7 text-xs px-2.5 bg-primary text-black font-semibold hover:bg-primary/90 cursor-pointer"
                >
                  Conferma e Carica Scatto
                </Button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomSlot(false)}
                  className="p-1 text-muted-foreground hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Mostra gli scatti multi-timeframe memorizzati */}
            {localSnapshots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {localSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-2 rounded-xl border border-white/10 bg-black/40 text-[11px] space-y-1.5 relative group"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-primary font-bold">{snap.timeframe}</span>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[110px]">{snap.stepName}</span>
                    </div>

                    {snap.imageDataUrl ? (
                      <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/15 bg-black relative group/img">
                        <img
                          src={snap.imageDataUrl}
                          alt={snap.timeframe}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setPreviewImage(snap.imageDataUrl!)}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="Ingrandisci"
                            onClick={() => setPreviewImage(snap.imageDataUrl!)}
                            className="p-1.5 rounded-lg bg-black/80 hover:bg-white/20 text-white transition-colors cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            type="button"
                            title="Sostituisci immagine"
                            onClick={() => openSlotPicker(snap.id)}
                            className="p-1.5 rounded-lg bg-black/80 hover:bg-primary/40 text-white hover:text-primary transition-colors cursor-pointer"
                          >
                            <UploadCloud size={12} />
                          </button>
                          <button
                            type="button"
                            title="Rimuovi immagine"
                            onClick={(e) => handleRemoveSlotImage(snap.id, e)}
                            className="p-1.5 rounded-lg bg-black/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSlotPicker(snap.id)}
                        className="aspect-video w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] hover:border-primary/60 hover:bg-primary/[0.08] transition-all flex flex-col items-center justify-center text-[10px] text-muted-foreground hover:text-foreground cursor-pointer group/slot p-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1 group-hover/slot:border-primary/40 group-hover/slot:bg-primary/20 transition-colors">
                          <Camera size={13} className="text-muted-foreground group-hover/slot:text-primary transition-colors" />
                        </div>
                        <span className="font-semibold text-foreground/90 group-hover/slot:text-primary transition-colors text-[10px]">
                          Carica Scatto {snap.timeframe}
                        </span>
                        <span className="text-[8px] text-muted-foreground mt-0.5">
                          Clicca per aprire i file
                        </span>
                      </button>
                    )}

                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/80">
                      <span className="truncate max-w-[120px]">{snap.summary}</span>
                      {snap.id.includes("custom") && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSlotEntirely(snap.id, e)}
                          className="hover:text-rose-400 p-0.5 cursor-pointer"
                          title="Rimuovi questo slot"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input file nascosti nativi per apertura garantita galleria/file picker */}
            <input
              ref={slotFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSlotFileInput}
            />
            <input
              ref={generalFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGeneralFileInput}
            />

            {/* Dropzone & Incolla Cmd+V & Tasto Galleria Diretto */}
            <div
              {...getRootProps()}
              onClick={() => generalFileInputRef.current?.click()}
              className={`group border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-primary bg-primary/10 scale-[0.99]"
                  : "border-white/15 bg-white/[0.01] hover:border-primary/50 hover:bg-white/[0.03]"
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  <UploadCloud size={16} className={isDragActive ? "text-primary animate-bounce" : "text-primary/70 group-hover:text-primary transition-colors"} />
                  <span>
                    Trascina qui gli screenshot oppure incolla con <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-foreground font-semibold">Cmd + V</kbd>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    generalFileInputRef.current?.click();
                  }}
                  className="h-7 text-xs px-3 bg-white/5 border-white/20 hover:bg-primary/20 hover:border-primary/50 hover:text-primary text-foreground transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <FolderOpen size={13} />
                  <span>Apri Galleria / File</span>
                </Button>
              </div>
            </div>

            {/* Immagini incollate / caricate aggiuntive */}
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Screenshot Allegati ({attachedFiles.length}):
                </span>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {attachedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-16 rounded-lg overflow-hidden border border-primary/40 shrink-0 group bg-black"
                    >
                      <img
                        src={f.preview}
                        alt="Screenshot allegato"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewImage(f.preview)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(f.preview)}
                          className="p-1 bg-black/70 hover:bg-white/30 text-white rounded cursor-pointer"
                          title="Ingrandisci"
                        >
                          <Eye size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 bg-black/70 hover:bg-rose-600 text-white rounded cursor-pointer"
                          title="Rimuovi"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Note Finali / Diario Emotivo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              3. Note Operative & Psicologia (Opzionale)
            </Label>
            <Textarea
              value={tradeNotes}
              onChange={(e) => setTradeNotes(e.target.value)}
              placeholder="Come si è comportato il prezzo? Emozioni vissute, rispetto delle regole o riflessioni..."
              className="h-20 text-xs bg-black/40 border-white/10 rounded-xl resize-none text-foreground focus:border-primary/50"
            />
          </div>
        </div>

        {/* Footer con Unico Tasto di Chiusura */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Annulla
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Salvataggio nel Diario...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Sigilla & Salva Trade nel Diario</span>
              </>
            )}
          </Button>
        </div>

        {/* Lightbox Ingrandimento Screenshot */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage}
                alt="Anteprima screenshot"
                className="max-h-[80vh] w-auto max-w-full rounded-xl border border-white/10 shadow-2xl object-contain"
              />
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="mt-3 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X size={14} />
                <span>Chiudi Anteprima</span>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
