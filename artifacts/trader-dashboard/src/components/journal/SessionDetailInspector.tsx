import React, { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateJournalEntry,
  getGetJournalEntriesQueryKey,
  type JournalEntry,
  type UpdateJournalEntryRequestResult,
} from "@workspace/api-client-react";
import {
  ShieldCheck,
  Target,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X,
  Brain,
  ArrowRight,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  PenLine,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessSession, ProcessEvidence, ProcessMethod } from "@/lib/traderProcessApi";
import { parseTradeContent, tradeDuration, tradeRMultiple } from "@/lib/parseTradeContent";

export const VIRTU_TAGS = [
  { id: "piano", label: "Piano Rispettato", icon: "🛡️", isPositive: true },
  { id: "pazienza", label: "Pazienza Attesa", icon: "⏳", isPositive: true },
  { id: "target", label: "Target Eseguito", icon: "🎯", isPositive: true },
] as const;

export const LEAK_TAGS = [
  { id: "fomo", label: "FOMO", icon: "🌪️", isPositive: false },
  { id: "anticipazione", label: "Anticipazione", icon: "⚡", isPositive: false },
  { id: "uscita_prematura", label: "Uscita Anticipata", icon: "✂️", isPositive: false },
  { id: "revenge", label: "Revenge", icon: "🩸", isPositive: false },
  { id: "esitazione", label: "Esitazione", icon: "🥶", isPositive: false },
] as const;

export const AVAILABLE_TAGS = [...VIRTU_TAGS, ...LEAK_TAGS] as const;

/**
 * Filtra e isola esclusivamente le note e considerazioni personali scritte dal trader,
 * rimuovendo dump FX Blue, Ticket e linee conformi a chiavi metadati (Symbol, Direction, Entry Price, ecc.).
 */
function extractTraderNotes(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lines = raw.split("\n");
  const traderLines: string[] = [];
  const metaKeys = new Set([
    "ticket", "source", "broker", "account", "symbol", "direction",
    "status", "volume", "open time", "close time", "entry price",
    "exit price", "stop loss", "take profit", "profit", "commission",
    "swap", "rischio prezzo", "rendimento conto", "open", "close", "pnl",
    "size", "entry", "exit", "stop", "tp", "sl", "result", "magic", "trade"
  ]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("FX Blue") || trimmed.includes("Ticket:")) continue;
    const sep = trimmed.indexOf(":");
    if (sep > 0) {
      const key = trimmed.slice(0, sep).trim().toLowerCase();
      if (metaKeys.has(key)) {
        continue;
      }
    }
    traderLines.push(trimmed);
  }

  const result = traderLines.join("\n").trim();
  return result.length > 0 ? result : null;
}

interface SessionDetailInspectorProps {
  session?: ProcessSession | null;
  evidence?: ProcessEvidence[];
  method?: ProcessMethod;
  journalEntry?: JournalEntry | null;
  tradeIndex?: number;
  totalTrades?: number;
  onNavigateTrade?: (direction: "prev" | "next") => void;
  activeLiveSession?: ProcessSession | null;
  className?: string;
}

export function SessionDetailInspector({
  session,
  evidence = [],
  method,
  journalEntry,
  tradeIndex = 0,
  totalTrades = 0,
  onNavigateTrade,
  activeLiveSession,
  className,
}: SessionDetailInspectorProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const tradeImages = useMemo(() => {
    return journalEntry?.images ?? [];
  }, [journalEntry?.images]);

  const firstImage = tradeImages[0] ?? null;
  const totalImagesCount = tradeImages.length;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft" && tradeImages.length > 1) {
        setLightboxIndex((prev) => (prev !== null ? (prev - 1 + tradeImages.length) % tradeImages.length : null));
      }
      if (e.key === "ArrowRight" && tradeImages.length > 1) {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % tradeImages.length : null));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, tradeImages.length]);

  // Active view: "dossier" (historical inspection) or "varco" (live operative window)
  const hasLiveVarco = Boolean(activeLiveSession && activeLiveSession.state !== "closed");
  const [inspectorMode, setInspectorMode] = useState<"dossier" | "varco">("dossier");

  // Parse journal entry content if available
  const parsedEntry = useMemo(() => {
    return journalEntry ? parseTradeContent(journalEntry.content ?? "") : null;
  }, [journalEntry]);

  // Clean symbol: strip .R and ticket numbers
  const cleanSymbol = useMemo(() => {
    const raw = parsedEntry?.symbol ?? session?.plan?.market ?? journalEntry?.title ?? "ASSET";
    return raw.replace(/\.R$/, "").replace(/#\d+/g, "").trim();
  }, [parsedEntry?.symbol, session?.plan?.market, journalEntry?.title]);

  // Direction: LONG vs SHORT
  const direction = useMemo(() => {
    const d = parsedEntry?.direction ?? session?.plan?.decision ?? (journalEntry?.title.includes("BUY") ? "BUY" : journalEntry?.title.includes("SELL") ? "SELL" : "TRADE");
    return d === "BUY" ? "LONG" : d === "SELL" ? "SHORT" : d;
  }, [parsedEntry?.direction, session?.plan?.decision, journalEntry?.title]);

  const isLong = direction === "LONG" || direction === "BUY";
  const isShort = direction === "SHORT" || direction === "SELL";

  // Clean notes: filter out raw FX Blue ticket dumps completely!
  const cleanUserComment = useMemo(() => {
    if (parsedEntry?.comment && parsedEntry.comment.trim().length > 0) {
      const parsedClean = extractTraderNotes(parsedEntry.comment);
      if (parsedClean) return parsedClean;
    }
    if (session?.closure?.notes) {
      const raw = session.closure.notes;
      if (!raw.includes("FX Blue") && !raw.includes("Ticket:")) {
        const cleaned = extractTraderNotes(raw);
        if (cleaned) return cleaned;
      }
    }
    if (journalEntry?.content) {
      const raw = journalEntry.content;
      if (!raw.includes("FX Blue") && !raw.includes("Ticket:")) {
        const cleaned = extractTraderNotes(raw);
        if (cleaned) return cleaned;
      }
    }
    return null;
  }, [parsedEntry?.comment, session?.closure?.notes, journalEntry?.content]);

  // PnL & Result
  const pnl = parsedEntry?.profit ?? null;
  const isWin = journalEntry ? journalEntry.result === "win" : pnl != null ? pnl > 0 : false;
  const isLoss = journalEntry ? journalEntry.result === "loss" : pnl != null ? pnl < 0 : false;

  // Prices
  const entryPrice = parsedEntry?.entryPrice ?? (session?.plan?.entry ? parseFloat(session.plan.entry) : null);
  const exitPrice = parsedEntry?.exitPrice ?? null;
  const stopLoss = parsedEntry?.stopLoss ?? (session?.plan?.stop ? parseFloat(session.plan.stop) : null);
  const takeProfit = parsedEntry?.takeProfit ?? null;
  const volume = parsedEntry?.volume ?? 0.01;
  const duration = parsedEntry ? tradeDuration(parsedEntry) : null;
  const commission = parsedEntry?.commission ?? 0;
  const swap = parsedEntry?.swap ?? 0;

  // Delta pips / price difference
  const priceDelta = entryPrice && exitPrice ? Math.abs(exitPrice - entryPrice).toFixed(2) : null;
  const rMult = parsedEntry ? tradeRMultiple(parsedEntry) : null;
  const executionGrade = isWin ? "A+" : isLoss ? "B" : "A";

  const displayDate = journalEntry?.tradeDate ? journalEntry.tradeDate.slice(0, 10) : session?.day ?? "Data Odierna";
  const displayTime = parsedEntry?.openTime ? parsedEntry.openTime.slice(11, 16) : null;

  const hasStop = Boolean(stopLoss && stopLoss > 0);

  // Queries & Mutations for interactive updates
  const queryClient = useQueryClient();
  const updateMutation = useUpdateJournalEntry();

  // Active cognitive tags
  const activeTags = useMemo(() => {
    if (!journalEntry?.tags) return new Set<string>();
    const parsed = journalEntry.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return new Set(parsed);
  }, [journalEntry?.tags]);

  // Local editable note
  const [localNote, setLocalNote] = useState<string>("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  useEffect(() => {
    setLocalNote(cleanUserComment ?? "");
    setNoteSavedFeedback(false);
  }, [cleanUserComment, journalEntry?.id]);

  const handleToggleTag = async (tagId: string) => {
    if (!journalEntry) return;
    const currentTagsList = (journalEntry.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const tagLower = tagId.toLowerCase();
    const exists = currentTagsList.some((t) => t.toLowerCase() === tagLower);

    const updatedList = exists
      ? currentTagsList.filter((t) => t.toLowerCase() !== tagLower)
      : [...currentTagsList, tagId];

    const newTagsString = updatedList.join(",");

    try {
      await updateMutation.mutateAsync({
        id: journalEntry.id,
        data: {
          title: journalEntry.title,
          content: journalEntry.content ?? "",
          tradeDate: journalEntry.tradeDate,
          result: journalEntry.result as UpdateJournalEntryRequestResult,
          tags: newTagsString,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
    } catch (err) {
      console.error("Failed to update journal tags:", err);
    }
  };

  const handleSaveNote = async () => {
    if (!journalEntry) return;
    setIsSavingNote(true);
    try {
      const rawContent = journalEntry.content ?? "";
      const lines = rawContent.split("\n");
      const brokerLines: string[] = [];
      for (const line of lines) {
        const sep = line.indexOf(":");
        if (sep > 0) {
          const key = line.slice(0, sep).trim().toLowerCase();
          if ([
            "ticket", "source", "broker", "account", "symbol", "direction",
            "status", "volume", "open time", "close time", "entry price",
            "exit price", "stop loss", "take profit", "profit", "commission",
            "swap", "rischio prezzo", "rendimento conto"
          ].includes(key)) {
            brokerLines.push(line);
          }
        }
      }

      const trimmedNote = localNote.trim();
      let newContent = "";
      if (brokerLines.length > 0) {
        newContent = brokerLines.join("\n") + (trimmedNote ? `\n\n${trimmedNote}` : "");
      } else {
        newContent = trimmedNote;
      }

      await updateMutation.mutateAsync({
        id: journalEntry.id,
        data: {
          title: journalEntry.title,
          content: newContent,
          tradeDate: journalEntry.tradeDate,
          result: journalEntry.result as UpdateJournalEntryRequestResult,
          tags: journalEntry.tags ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      setNoteSavedFeedback(true);
      setTimeout(() => setNoteSavedFeedback(false), 2500);
    } catch (err) {
      console.error("Failed to save personal note:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Dynamic Algorithmic Post-Mortem (Verdetto Tattico Sovrano)
  const verdettoTattico = useMemo(() => {
    const pnlStr = pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "";
    const rStr = rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "";

    if (isWin) {
      if (hasStop) {
        return {
          badge: "VITTORIA CONFORME",
          type: "success" as const,
          riskStatus: `Stop a ${stopLoss?.toFixed(2)}`,
          executionStatus: "Rischio Circoscritto",
          summary: "Esecuzione da manuale: stop inserito a mercato prima dell'apertura ed espansione a target.",
          text: `Operazione conforme al protocollo. Rischio circoscritto prima dell'apertura con stop a ${stopLoss?.toFixed(2)}, estensione favorevole che ha consentito una chiusura monetaria netta di ${pnlStr || "profitto"}${rStr ? ` (${rStr})` : ""}. Nessuna deviazione strutturale rilevata.`,
        };
      } else {
        return {
          badge: "PROFITTO AD ALTO RISCHIO",
          type: "warning" as const,
          riskStatus: "Assenza di Stop",
          executionStatus: "Violazione di Protezione",
          summary: "Gain anomalo privo di stop: la fortuna ha coperto un grave errore procedurale ad alto rischio.",
          text: `Guadagno anomalo ad alto pericolo sistemico. Il trade ha chiuso in profitto (${pnlStr || "positivo"}) ma la totale assenza di stop loss registrato a mercato espone il conto a rischio di rovina. Errore procedurale mascherato da fortuna.`,
        };
      }
    }

    if (isLoss) {
      if (hasStop) {
        return {
          badge: "PERDITA CONTROLLATA",
          type: "neutral" as const,
          riskStatus: `Stop a ${stopLoss?.toFixed(2)}`,
          executionStatus: "Rischio Reciso",
          summary: "Stop loss da manuale: perdita delimitata sul nascere senza trascinamento emotivo del capitale.",
          text: `Perdita da manuale operativo. Lo stop loss prefissato a ${stopLoss?.toFixed(2)} ha reciso il rischio sul nascere (${pnlStr || "loss"}${rStr ? `, ${rStr}` : ""}). Il capitale operativo è rimasto intatto senza trascinamento emotivo.`,
        };
      } else {
        return {
          badge: "VIOLAZIONE DI PROTOCOLLO",
          type: "danger" as const,
          riskStatus: "Nessun Stop Loss",
          executionStatus: "Perdita Incontrollata",
          summary: "Grave violazione del metodo: operazione a mercato priva di ordine limite di arresto.",
          text: `Grave anomalia operativa. Posizione chiusa in perdita (${pnlStr || "negativo"}) senza barriera di protezione prefissata. Urgente isolare il bias ed eliminare qualunque esecuzione priva di ordine limite di arresto.`,
        };
      }
    }

    return {
      badge: "PROTEZIONE CAPITALE",
      type: "gold" as const,
      riskStatus: hasStop ? `Stop a ${stopLoss?.toFixed(2)}` : "Break Even",
      executionStatus: "Capitale Preservato",
      summary: "Chiusura neutrale di salvaguardia: liquidità e stabilità mentale preservate per la prossima finestra.",
      text: `Chiusura neutrale di salvaguardia (${pnlStr || "0.00€"}). Il rischio è stato azzerato tempestivamente preservando la liquidità e la stabilità psicologica per la prossima finestra.`,
    };
  }, [isWin, isLoss, hasStop, stopLoss, pnl, rMult]);

  // Dynamic Rule for Tomorrow (Regola Consolidata)
  const regolaConsolidata = useMemo(() => {
    if (activeTags.has("fomo")) {
      return "Se perdi il trigger sul livello, il trade è scaduto. Rincorrere il prezzo porta solo a stop non protetti e slippage.";
    }
    if (activeTags.has("anticipazione")) {
      return "Attendi sempre la chiusura della candela di conferma. La fretta di anticipare trasforma una configurazione A+ in puro azzardo.";
    }
    if (activeTags.has("uscita_prematura")) {
      return "Lascia lavorare il piano. Tagliare i profitti precocemente per ansia compromette l'aspettativa matematica del sistema.";
    }
    if (activeTags.has("revenge")) {
      return "Allontana le mani dalla tastiera dopo una perdita. Nessun trade di rivalsa: il mercato non ha debiti verso di te.";
    }
    if (activeTags.has("esitazione")) {
      return "Fidati del setup convalidato. Se le condizioni del piano sono verificate, il click deve essere automatico e sereno.";
    }

    if (!hasStop) {
      return "Vincolo Inviolabile: Nessun ordine a mercato senza stop loss pre-calcolato e immesso contestualmente.";
    }
    if (isWin) {
      return "Consolida il profitto. Chiudi il terminale dopo un gain conforme; l'overconfidence nella sessione successiva è fatale.";
    }
    if (isLoss) {
      return "Accetta la spesa del trade. Nessun raddoppio di size: il prossimo trade segue rigorosamente lo stesso rischio standard.";
    }
    return "Preserva il capitale. Esegui la schematica senza deviazioni emotive.";
  }, [activeTags, hasStop, isWin, isLoss]);

  // Integrity Index (0-100%)
  const integrityScore = useMemo(() => {
    let score = 100;
    if (!hasStop) score -= 40;
    if (activeTags.has("fomo")) score -= 20;
    if (activeTags.has("anticipazione")) score -= 15;
    if (activeTags.has("revenge")) score -= 30;
    if (activeTags.has("uscita_prematura")) score -= 10;
    if (activeTags.has("piano")) score = Math.min(100, score + 10);
    return Math.max(25, Math.min(100, score));
  }, [hasStop, activeTags]);

  // Checklist items for Il Varco
  const varcoChecklist = useMemo(() => {
    const list = [
      "Contesto HTF e bias direzionale verificati",
      "Pattern di price action completato e confermato",
      "Stop loss strutturale posizionato a mercato",
      "Rischio monetario prefissato prima dell'apertura",
      "Stato emotivo neutro e assenza totale di FOMO",
    ];
    const liveChecks = activeLiveSession?.checklist ?? [];
    return list.map((item, idx) => ({
      label: item,
      checked: liveChecks[idx] ?? true,
    }));
  }, [activeLiveSession]);

  return (
    <div className={cn("flex flex-col h-full min-h-0 overflow-hidden bg-surface-1 rounded-2xl border border-border-subtle shadow-xl select-none p-3 gap-2", className)}>
      {/* ── TOP CONTROL BAR: DUAL PERSPECTIVE SWITCHER (STORICO vs IL VARCO LIVE) ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2/60 p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setInspectorMode("dossier")}
            className={cn(
              "px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1.5",
              inspectorMode === "dossier"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            <img src="/images/emblems/dossier.png" alt="" className="w-3.5 h-3.5 object-contain" />
            <span>Dossier Storico</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorMode("varco")}
            className={cn(
              "px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1.5",
              inspectorMode === "varco"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                hasLiveVarco ? "animate-ping bg-emerald-400" : "bg-text-lo/40"
              )} />
              <span className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                hasLiveVarco ? "bg-emerald-500" : "bg-text-lo/60"
              )} />
            </span>
            <span>Il Varco {hasLiveVarco ? "(Live)" : ""}</span>
          </button>
        </div>

        {/* Mode-specific Top Actions */}
        {inspectorMode === "dossier" ? (
          /* Historical Trade Stepper Navigator (< Trade 14 di 26 >) */
          totalTrades > 0 && (
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                disabled={tradeIndex <= 0}
                onClick={() => onNavigateTrade?.("prev")}
                className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-surface-2 text-text-lo hover:text-text-hi disabled:opacity-25 disabled:pointer-events-none transition-colors"
                title="Trade Precedente"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="px-1.5 text-text-lo whitespace-nowrap">
                Trade <strong className="text-text-hi">{tradeIndex + 1}</strong> di <strong className="text-text-hi">{totalTrades}</strong>
              </span>
              <button
                type="button"
                disabled={tradeIndex >= totalTrades - 1}
                onClick={() => onNavigateTrade?.("next")}
                className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-surface-2 text-text-lo hover:text-text-hi disabled:opacity-25 disabled:pointer-events-none transition-colors"
                title="Trade Successivo"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )
        ) : (
          /* Live Varco Status Pill */
          <span className="font-mono text-[10px] text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <Radio size={11} className="animate-pulse" />
            <span>FINESTRA OPERATIVA</span>
          </span>
        )}
      </div>

      {/* ── CONDITIONAL VIEW CONTAINER ── */}
      {inspectorMode === "dossier" ? (
        /* ═══════════════════════════════════════════════════════════
           VISTA A: DOSSIER TATTICO DEL TRADE SELEZIONATO (STORICO)
           ═══════════════════════════════════════════════════════════ */
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Header Strip with Asset, Direction & Hero PnL */}
          <div className="shrink-0 flex items-center justify-between gap-2 bg-surface-0/60 rounded-xl border border-border-subtle/80 p-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-bold text-text-hi">
                {cleanSymbol}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded px-2 py-0.2 text-[9px] font-bold border",
                  isLong
                    ? "border-success/30 bg-success/10 text-success"
                    : isShort
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border-subtle text-text-lo"
                )}
              >
                {isLong ? <ArrowUpRight size={10} /> : isShort ? <ArrowDownRight size={10} /> : null}
                {direction}
              </span>
              <span className="font-mono text-[10px] text-text-lo truncate">
                {displayDate} {displayTime ? `· ${displayTime}` : ""}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
                  executionGrade.startsWith("A")
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-[#C5A059]/40 bg-[#C5A059]/15 text-[#D4AF37]"
                )}
              >
                GRADO {executionGrade}
              </span>
              <span
                className={cn(
                  "font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border shadow-sm",
                  pnl != null && pnl > 0
                    ? "border-success/40 bg-success/20 text-success"
                    : pnl != null && pnl < 0
                    ? "border-destructive/40 bg-destructive/20 text-destructive"
                    : "border-border-subtle text-text-lo bg-surface-2"
                )}
              >
                {pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} €` : "0.00 €"}
              </span>
            </div>
          </div>

          {/* Block 1: Tactical Price Coordinates & Execution Radar (~42% height) */}
          <div className="h-[42%] min-h-[165px] flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <img src="/images/emblems/dottrina.png" alt="" className="w-3.5 h-3.5 object-contain" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
                  Coordinate di Esecuzione
                </span>
              </div>
              <div className="flex items-center gap-2">
                {priceDelta && (
                  <span className="font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 px-1.5 py-0.2 rounded border border-[#C5A059]/25 font-bold">
                    DELTA: {priceDelta} PUNTI
                  </span>
                )}
                {firstImage && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(0)}
                    className="flex items-center gap-1.5 font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 hover:bg-[#C5A059]/20 px-2 py-0.5 rounded border border-[#C5A059]/30 hover:border-[#C5A059]/70 transition-all cursor-zoom-in group/img"
                    title="Visualizza screenshot ad alta risoluzione"
                  >
                    <img
                      src={firstImage.url}
                      alt="Thumbnail"
                      className="w-3.5 h-3.5 rounded-xs object-cover border border-[#C5A059]/30 group-hover/img:scale-110 transition-transform"
                    />
                    <span className="font-semibold">Snapshot HD</span>
                    {totalImagesCount > 1 && (
                      <span className="text-[8px] bg-black/60 px-1 rounded text-white/70">
                        +{totalImagesCount - 1}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Price Ladder 4-Box Matrix */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px] py-0.5 shrink-0">
              <div className="rounded bg-surface-2 border border-border-subtle p-1 text-center">
                <span className="text-[8px] uppercase tracking-wider text-[#C5A059] font-semibold block">Entry</span>
                <span className="text-text-hi font-bold text-xs truncate block">
                  {entryPrice ? entryPrice.toFixed(2) : "—"}
                </span>
              </div>
              <div className="rounded bg-surface-2 border border-border-subtle p-1 text-center">
                <span className="text-[8px] uppercase tracking-wider text-text-lo font-semibold block">Exit</span>
                <span className="text-text-hi font-bold text-xs truncate block">
                  {exitPrice ? exitPrice.toFixed(2) : "—"}
                </span>
              </div>
              <div className="rounded bg-destructive/10 border border-destructive/20 p-1 text-center">
                <span className="text-[8px] uppercase tracking-wider text-destructive font-semibold block">Stop Loss</span>
                <span className="text-destructive font-bold text-xs truncate block">
                  {stopLoss ? stopLoss.toFixed(2) : "Strutturale"}
                </span>
              </div>
              <div className="rounded bg-success/10 border border-success/20 p-1 text-center">
                <span className="text-[8px] uppercase tracking-wider text-success font-semibold block">Target</span>
                <span className="text-success font-bold text-xs truncate block">
                  {takeProfit ? takeProfit.toFixed(2) : "Dinamico"}
                </span>
              </div>
            </div>

            {/* Dynamic SVG Price Corridor & Trade Image Thumbnail */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-0.5 overflow-hidden">
              <div className="w-full h-full rounded-lg border border-border-subtle/50 bg-surface-2/40 px-3 py-0.5 flex items-center justify-between">
                <div className="flex flex-col justify-center font-mono text-[10px] space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 text-text-hi font-bold">
                    <Activity size={12} className="text-[#C5A059]" />
                    <span className="truncate">Corridoio di Volatilità: {cleanSymbol} ({direction})</span>
                  </div>
                  <span className="text-[9px] text-text-lo truncate">
                    {entryPrice && exitPrice
                      ? `Esecuzione: ${entryPrice.toFixed(2)} → ${exitPrice.toFixed(2)} (${priceDelta} pips)`
                      : "Operazione eseguita e consolidata a mercato"}
                  </span>
                  <span className="text-[9px] text-[#C5A059]">
                    Rapporto R:R Conseguito: {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "1.0R Normativo"}
                  </span>
                </div>

                {/* Right side: Screenshot Thumbnail or SVG Visual Vector */}
                {firstImage ? (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(0)}
                    className="relative shrink-0 w-24 sm:w-28 h-11 rounded-lg overflow-hidden border border-[#C5A059]/40 hover:border-[#C5A059] shadow-md transition-all group/snap cursor-zoom-in bg-black/60 ml-2"
                    title="Clicca per ingrandire lo screenshot del trade"
                  >
                    <img
                      src={firstImage.url}
                      alt="Screenshot trade"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover/snap:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/snap:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 size={13} className="text-white drop-shadow" />
                    </div>
                    {totalImagesCount > 1 && (
                      <div className="absolute bottom-0.5 right-0.5 bg-black/85 px-1 py-0.2 rounded text-[8px] font-mono font-bold text-white/90 border border-white/10 flex items-center gap-0.5">
                        <ImageIcon size={9} />+{totalImagesCount - 1}
                      </div>
                    )}
                  </button>
                ) : (
                  <svg className="w-28 h-10 shrink-0 opacity-85" viewBox="0 0 110 50" fill="none">
                    <line x1="0" y1="12" x2="110" y2="12" stroke="rgba(16,185,129,0.3)" strokeDasharray="2 2" />
                    <line x1="0" y1="25" x2="110" y2="25" stroke="rgba(197,160,89,0.4)" strokeDasharray="3 3" />
                    <line x1="0" y1="40" x2="110" y2="40" stroke="rgba(239,68,68,0.3)" strokeDasharray="2 2" />
                    {isWin ? (
                      <>
                        <path d="M10 32 L35 28 L60 25 L80 18 L100 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="60" cy="25" r="3" fill="#D4AF37" />
                        <circle cx="100" cy="12" r="3" fill="#10b981" />
                      </>
                    ) : (
                      <>
                        <path d="M10 20 L35 23 L60 25 L80 34 L100 42" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="60" cy="25" r="3" fill="#D4AF37" />
                        <circle cx="100" cy="42" r="3" fill="#ef4444" />
                      </>
                    )}
                  </svg>
                )}
              </div>
            </div>

            {/* 4-Cell Telemetry Row */}
            <div className="pt-0.5 border-t border-white/[0.06] grid grid-cols-4 gap-1 text-[10px] font-mono text-center text-text-lo shrink-0">
              <div className="bg-surface-2/60 rounded py-0.5">
                <span className="text-[8px] uppercase block text-text-lo/70">Volume</span>
                <strong className="text-text-hi">{volume} lot</strong>
              </div>
              <div className="bg-surface-2/60 rounded py-0.5">
                <span className="text-[8px] uppercase block text-text-lo/70">Durata</span>
                <strong className="text-text-hi">{duration || "Intraday"}</strong>
              </div>
              <div className="bg-surface-2/60 rounded py-0.5">
                <span className="text-[8px] uppercase block text-text-lo/70">Comm.</span>
                <strong className="text-text-hi">{commission.toFixed(2)}€</strong>
              </div>
              <div className="bg-surface-2/60 rounded py-0.5">
                <span className="text-[8px] uppercase block text-text-lo/70">Swap</span>
                <strong className="text-text-hi">{swap.toFixed(2)}€</strong>
              </div>
            </div>
          </div>

          {/* Block 2: Sovereign Truth, Dynamic Cognitive Audit & Discipline (~58% height, fully saturated) */}
          <div className="flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 shadow-inner overflow-hidden select-none">
            {/* Header Strip with Emblem, Badges & Integrated Integrity Barometer */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <img src="/images/emblems/libro-della-verita.png" alt="" className="w-3.5 h-3.5 object-contain" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
                  Disciplina &amp; Consolidamento
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] shrink-0">
                {hasStop ? (
                  <span className="rounded bg-success/15 border border-success/30 px-1.5 py-0.2 text-success font-bold flex items-center gap-1">
                    <Check size={10} />
                    <span>STOP PROTETTO</span>
                  </span>
                ) : (
                  <span className="rounded bg-destructive/15 border border-destructive/30 px-1.5 py-0.2 text-destructive font-bold flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} />
                    <span>NO STOP LOSS</span>
                  </span>
                )}
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.2 font-bold",
                    isWin
                      ? "border-success/30 bg-success/10 text-success"
                      : isLoss
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]"
                  )}
                >
                  {isWin ? `${rMult ? `+${rMult}R` : "+1R"} ESPANSIONE` : isLoss ? "-1.0R ASSORBITO" : "0.0R PAREGGIO"}
                </span>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.2 font-bold flex items-center gap-1",
                    integrityScore >= 80
                      ? "border-success/40 bg-success/15 text-success"
                      : integrityScore >= 50
                      ? "border-[#C5A059]/40 bg-[#C5A059]/15 text-[#C5A059]"
                      : "border-destructive/40 bg-destructive/15 text-destructive"
                  )}
                  title={`Indice di conformità al protocollo: ${integrityScore}%`}
                >
                  <span>{integrityScore}%</span>
                </span>
              </div>
            </div>

            {/* Flexible Multi-Module Body (Organized, scannable & interactive) */}
            <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar min-h-0 py-1.5">
              {/* Module A: Structured Diagnostic Telemetry (Replaces the verbose wall-of-text) */}
              <div
                className={cn(
                  "rounded-xl border p-2 font-mono text-[11px] transition-all flex flex-col gap-1.5",
                  verdettoTattico.type === "success"
                    ? "border-success/30 bg-success/[0.04]"
                    : verdettoTattico.type === "warning" || verdettoTattico.type === "danger"
                    ? "border-destructive/30 bg-destructive/[0.04]"
                    : "border-border-subtle/80 bg-surface-2/40"
                )}
              >
                {/* Header row: Badge + Verdetto Algoritmico label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border flex items-center gap-1",
                        verdettoTattico.type === "success"
                          ? "border-success/30 bg-success/20 text-success"
                          : verdettoTattico.type === "warning" || verdettoTattico.type === "danger"
                          ? "border-destructive/30 bg-destructive/20 text-destructive"
                          : "border-[#C5A059]/30 bg-[#C5A059]/20 text-[#D4AF37]"
                      )}
                    >
                      {verdettoTattico.type === "success" ? (
                        <ShieldCheck size={10} />
                      ) : verdettoTattico.type === "danger" || verdettoTattico.type === "warning" ? (
                        <AlertTriangle size={10} />
                      ) : (
                        <CheckCircle2 size={10} />
                      )}
                      <span>{verdettoTattico.badge}</span>
                    </span>
                    <span className="text-[9px] text-text-lo/80 font-semibold uppercase tracking-wider">
                      Verdetto Algoritmico
                    </span>
                  </div>

                  <span className="text-[9px] text-text-lo font-mono">
                    {displayDate}
                  </span>
                </div>

                {/* 3 Telemetry Data Cells: Stop, Qualità, Esito */}
                <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                  <div className="bg-surface-1/90 border border-border-subtle/60 rounded px-1.5 py-1 text-center">
                    <span className="text-[7.5px] uppercase tracking-wider text-text-lo/70 block">Protezione Stop</span>
                    <strong className={cn("text-[9.5px] truncate block font-bold", hasStop ? "text-success" : "text-destructive")}>
                      {verdettoTattico.riskStatus}
                    </strong>
                  </div>
                  <div className="bg-surface-1/90 border border-border-subtle/60 rounded px-1.5 py-1 text-center">
                    <span className="text-[7.5px] uppercase tracking-wider text-text-lo/70 block">Esecuzione</span>
                    <strong className="text-[9.5px] text-text-hi truncate block font-bold">
                      {verdettoTattico.executionStatus}
                    </strong>
                  </div>
                  <div className="bg-surface-1/90 border border-border-subtle/60 rounded px-1.5 py-1 text-center">
                    <span className="text-[7.5px] uppercase tracking-wider text-text-lo/70 block">Rendimento</span>
                    <strong className={cn("text-[9.5px] truncate block font-bold", isWin ? "text-success" : isLoss ? "text-destructive" : "text-[#C5A059]")}>
                      {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "Normativo"}
                    </strong>
                  </div>
                </div>

                {/* High-signal 1-line verdict (scannable, no fluff) */}
                <p className="text-[9.5px] text-text-hi/90 leading-tight bg-surface-1/60 rounded px-2 py-1 border border-white/[0.04]">
                  {verdettoTattico.summary}
                </p>
              </div>

              {/* Module B: Interactive Cognitive & Emotional Audit (Virtù vs Bias) */}
              <div className="rounded-xl border border-border-subtle/70 bg-surface-2/40 p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-text-lo flex items-center gap-1">
                    <Brain size={11} className="text-[#C5A059]" />
                    <span>Audit Emotivo &amp; Bias Rilevato (1-Click)</span>
                  </span>
                  <span className="text-[8px] font-mono text-text-lo/60">
                    Clicca per alternare
                  </span>
                </div>

                {/* Sub-block B1: Virtù di Disciplina */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[7.5px] font-mono uppercase tracking-wider text-text-lo/70 font-semibold">
                    <ShieldCheck size={9} className="text-success" />
                    <span>Virtù Esecutive</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {VIRTU_TAGS.map((tag) => {
                      const isActive = activeTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 border",
                            isActive
                              ? "bg-success/20 border-success/60 text-success shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              : "bg-surface-1/90 border-border-subtle/80 text-text-lo/80 hover:text-text-hi hover:border-white/20"
                          )}
                        >
                          <span>{tag.icon}</span>
                          <span>{tag.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-block B2: Leak & Bias Operativi */}
                <div className="space-y-0.5 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1 text-[7.5px] font-mono uppercase tracking-wider text-text-lo/70 font-semibold">
                    <AlertTriangle size={9} className="text-destructive/80" />
                    <span>Leak &amp; Bias Rilevati</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {LEAK_TAGS.map((tag) => {
                      const isActive = activeTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 border",
                            isActive
                              ? "bg-destructive/20 border-destructive/60 text-destructive shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                              : "bg-surface-1/90 border-border-subtle/80 text-text-lo/80 hover:text-text-hi hover:border-white/20"
                          )}
                        >
                          <span>{tag.icon}</span>
                          <span>{tag.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Module C: Dynamic Rule for Tomorrow (Takeaway Tattico Diretto) */}
              <div className="rounded-lg bg-[#C5A059]/10 border-l-2 border-[#C5A059] border-y border-r border-[#C5A059]/20 p-2 font-mono flex items-start gap-2">
                <Target size={12} className="text-[#C5A059] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block text-[8px] uppercase tracking-wider font-bold text-[#C5A059]">
                    Regola Consolidata per Domani:
                  </span>
                  <p className="text-text-hi text-[9.5px] leading-snug mt-0.5">
                    {regolaConsolidata}
                  </p>
                </div>
              </div>

              {/* Module D: Personal Inline Debrief Editor with Quick Chips */}
              <div className="rounded-xl border border-border-subtle/70 bg-surface-2/40 p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-text-lo flex items-center gap-1">
                    <PenLine size={11} className="text-[#C5A059]" />
                    <span>Annotazione Tattica Personale</span>
                  </span>
                  <button
                    type="button"
                    disabled={isSavingNote}
                    onClick={handleSaveNote}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 border",
                      noteSavedFeedback
                        ? "bg-success/20 border-success/40 text-success"
                        : "bg-[#C5A059]/20 hover:bg-[#C5A059]/30 border-[#C5A059]/40 text-[#D4AF37]"
                    )}
                  >
                    {noteSavedFeedback ? (
                      <>
                        <Check size={10} />
                        <span>Salvato</span>
                      </>
                    ) : (
                      <>
                        <Save size={10} />
                        <span>{isSavingNote ? "Salvataggio..." : "Salva Debrief"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick starter chips */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[7.5px] font-mono text-text-lo/60 uppercase">Spunti:</span>
                  {[
                    { label: "+ Setup A+", text: "Setup A+ eseguito rigorosamente a piano." },
                    { label: "+ Pazienza", text: "Atteso il trigger di conferma senza fretta." },
                    { label: "! Uscita anticipata", text: "Uscita chiusa prima del target per ansia." },
                    { label: "! Stop stretto", text: "Stop loss troppo esposto al rumore di mercato." },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setLocalNote((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return chip.text;
                          if (trimmed.includes(chip.text)) return prev;
                          return `${trimmed}\n${chip.text}`;
                        });
                      }}
                      className="px-1.5 py-0.5 rounded bg-surface-1/80 hover:bg-surface-1 border border-border-subtle/80 text-[8px] font-mono text-text-lo hover:text-text-hi transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  placeholder="Scrivi le tue considerazioni su questo trade (contesto HTF, trigger, sensazioni a mercato)..."
                  className="w-full h-13 bg-surface-1/90 border border-border-subtle/80 rounded-lg p-1.5 font-mono text-[10px] text-text-hi placeholder:text-text-lo/40 resize-none focus:outline-none focus:border-[#C5A059]/60 leading-tight"
                />
              </div>
            </div>

            {/* Module E: Protocol Integrity Barometer Footer */}
            <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-text-lo shrink-0">
              <div className="flex items-center gap-2">
                <span>Integrità Esecutiva:</span>
                <div className="w-16 h-1.5 rounded-full bg-surface-2 overflow-hidden border border-border-subtle/60 flex">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      integrityScore >= 80 ? "bg-success" : integrityScore >= 50 ? "bg-[#C5A059]" : "bg-destructive"
                    )}
                    style={{ width: `${integrityScore}%` }}
                  />
                </div>
                <strong className={cn(integrityScore >= 80 ? "text-success" : integrityScore >= 50 ? "text-[#C5A059]" : "text-destructive")}>
                  {integrityScore}%
                </strong>
              </div>
              <span className="font-bold text-[#C5A059]">REGISTRATO NEL DIARIO</span>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════
           VISTA B: FINESTRA OPERATIVA LIVE — IL VARCO
           ═══════════════════════════════════════════════════════════ */
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5 overflow-hidden">
          {/* Live Varco Status Hero */}
          <div className="shrink-0 flex items-center justify-between gap-2 bg-surface-0/60 rounded-xl border border-border-subtle/80 p-2.5">
            <div className="flex items-center gap-2">
              <img
                src="/images/emblems/arsenale.png"
                alt="Il Varco"
                className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(197,160,89,0.3)] shrink-0"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-bold text-text-hi">
                    {activeLiveSession?.plan?.market ?? "XAUUSD"}
                  </span>
                  <span className="rounded bg-[#C5A059]/15 border border-[#C5A059]/30 px-1.5 py-0.2 font-mono text-[9px] font-bold text-[#D4AF37]">
                    {activeLiveSession?.plan?.setup ?? "Setup in Osservazione"}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-text-lo block">
                  Sessione {activeLiveSession?.day ?? "Odierna"} · {hasLiveVarco ? "In Corso" : "Archiviata"}
                </span>
              </div>
            </div>

            <span className="font-mono text-[10px] text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          {/* Block 1: Live Planned Levels & Guidance */}
          <div className="h-[46%] min-h-[185px] flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi flex items-center gap-1.5">
                <Target size={13} className="text-[#C5A059]" />
                Livelli Operativi Prefissati
              </span>
              <span className="font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 px-1.5 py-0.2 rounded border border-[#C5A059]/25 font-bold">
                {activeLiveSession?.plan?.decision === "wait" ? "ATTESA STRATEGICA" : "OPERAZIONE ATTIVA"}
              </span>
            </div>

            {/* Live Level Grid */}
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] py-1 shrink-0">
              <div className="rounded bg-surface-2 border border-border-subtle p-1.5 text-center">
                <span className="text-[8px] uppercase tracking-wider text-[#C5A059] font-semibold block">Entry Target</span>
                <span className="text-text-hi font-bold text-xs truncate block">
                  {activeLiveSession?.plan?.entry || "A Mercato"}
                </span>
              </div>
              <div className="rounded bg-destructive/10 border border-destructive/20 p-1.5 text-center">
                <span className="text-[8px] uppercase tracking-wider text-destructive font-semibold block">Stop Struttura</span>
                <span className="text-destructive font-bold text-xs truncate block">
                  {activeLiveSession?.plan?.stop || "Struttura"}
                </span>
              </div>
              <div className="rounded bg-surface-2 border border-border-subtle p-1.5 text-center">
                <span className="text-[8px] uppercase tracking-wider text-text-lo font-semibold block">Rischio Max</span>
                <span className="text-[#C5A059] font-bold text-xs truncate block">
                  {activeLiveSession?.plan?.initialRisk ? `${activeLiveSession.plan.initialRisk}€` : "1.0 R"}
                </span>
              </div>
            </div>

            {/* Invalidation Context */}
            <div className="rounded bg-surface-2/60 border border-border-subtle/60 p-2 font-mono text-[10px] space-y-1">
              <span className="text-text-lo/80 block text-[8px] uppercase tracking-wider font-bold">
                Soglia di Invalidazione:
              </span>
              <p className="text-text-hi line-clamp-2">
                {activeLiveSession?.plan?.invalidation || "Violazione della struttura di contesto HTF e riassorbimento del trigger."}
              </p>
            </div>

            {/* Telemetry Footer */}
            <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-text-lo shrink-0">
              <span>Metodo Attivo:</span>
              <strong className="text-text-hi">{method?.name ?? "Protocollo Standard"} v{method?.version ?? 1}</strong>
            </div>
          </div>

          {/* Block 2: Protocol Verification Checklist & Quick Jump to Il Varco */}
          <div className="flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-success" />
                Checklist Pre-Flight del Varco
              </span>
              <span className="font-mono text-[9px] text-success font-bold">CONFORME</span>
            </div>

            {/* Live Checklist Items */}
            <ul className="space-y-1 font-mono text-[10px] flex-1 overflow-y-auto custom-scrollbar py-1">
              {varcoChecklist.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-text-hi">
                  {item.checked ? (
                    <CheckCircle2 size={12} className="text-success shrink-0" />
                  ) : (
                    <Circle size={12} className="text-text-lo/40 shrink-0" />
                  )}
                  <span className={item.checked ? "text-text-hi truncate" : "text-text-lo truncate"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Action Button: Jump to Live Cockpit */}
            <div className="pt-2 border-t border-white/[0.06] shrink-0">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] py-2 px-3 font-mono text-xs font-bold text-black shadow-lg hover:brightness-110 transition-all select-none"
              >
                <span>Apri Finestra Operativa (Il Varco)</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX MODAL FOR SCREENSHOTS ── */}
      {lightboxIndex !== null && tradeImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl flex flex-col items-center justify-center p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top header */}
            <div className="w-full flex items-center justify-between px-2 pb-2 text-xs font-mono text-text-lo border-b border-white/[0.06] mb-2">
              <span className="text-[#C5A059] font-bold">
                Snapshot {lightboxIndex + 1} di {tradeImages.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={tradeImages[lightboxIndex].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-1.5 text-text-lo hover:text-white transition-colors"
                  title="Apri a dimensione reale"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="rounded-full bg-white/10 p-1.5 text-text-lo hover:text-white transition-colors"
                  title="Chiudi (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Navigation arrows if multiple images */}
            {tradeImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((lightboxIndex - 1 + tradeImages.length) % tradeImages.length);
                  }}
                  className="absolute left-5 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/70 p-2.5 text-white hover:bg-[#C5A059] hover:text-black transition-colors"
                  title="Precedente (Freccia Sinistra)"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((lightboxIndex + 1) % tradeImages.length);
                  }}
                  className="absolute right-5 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/70 p-2.5 text-white hover:bg-[#C5A059] hover:text-black transition-colors"
                  title="Successivo (Freccia Destra)"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <img
              src={tradeImages[lightboxIndex].url}
              alt="Snapshot Trade Ingrandito"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
