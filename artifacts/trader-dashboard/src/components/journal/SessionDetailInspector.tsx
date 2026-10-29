import React, { memo, useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateJournalEntry,
  useGetJournalEntries,
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
  Award,
  Wind,
  Compass,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { priceDecimals } from "@/components/backtest-terminal/format";
import type { ProcessSession, ProcessEvidence, ProcessMethod } from "@/lib/traderProcessApi";
import { parseTradeContent, tradeDuration, tradeRMultiple } from "@/lib/parseTradeContent";
import { HonorCardShareModal } from "@/components/honor-card/HonorCardShareModal";
import type { HonorCardData } from "@/lib/honorCardGenerator";
import { queueOfflineMutation } from "@/lib/journalOfflineSync";
import { TacticalBreathModal } from "../cockpit/TacticalBreathModal";
import { DisciplineVirtueRadarModal } from "./DisciplineVirtueRadarModal";
import { DisciplineBioTensionModal } from "./DisciplineBioTensionModal";
import { DisciplineBioTensionChart, type TradeBioTelemetryData } from "./DisciplineBioTensionChart";

export const VIRTU_TAGS = [
  { id: "piano", label: "Piano Rispettato", desc: "Regole eseguite", icon: "◆", isPositive: true },
  { id: "pazienza", label: "Pazienza Attesa", desc: "Atteso il trigger", icon: "◈", isPositive: true },
  { id: "target", label: "Target Eseguito", desc: "Presa di profitto", icon: "◎", isPositive: true },
  { id: "calma", label: "Calma & Respiro", desc: "Centratura zen", icon: "✧", isPositive: true },
] as const;

export const LEAK_TAGS = [
  { id: "fomo", label: "FOMO", desc: "Inseguito il prezzo", icon: "▲", isPositive: false },
  { id: "anticipazione", label: "Anticipazione", desc: "Entrata prematura", icon: "⚡", isPositive: false },
  { id: "uscita_prematura", label: "Uscita Anticipata", desc: "Chiuso per ansia", icon: "✕", isPositive: false },
  { id: "revenge", label: "Revenge", desc: "Rivalsa emotiva", icon: "❖", isPositive: false },
  { id: "esitazione", label: "Esitazione", desc: "Blocco sul trigger", icon: "▪", isPositive: false },
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

export const SessionDetailInspector = memo(function SessionDetailInspector({
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

  // Direction: LONG vs SHORT with intelligent heuristic deduction
  const direction = useMemo(() => {
    const raw = (parsedEntry?.direction ?? session?.plan?.decision ?? "").toUpperCase();
    if (raw === "BUY" || raw === "LONG") return "LONG";
    if (raw === "SELL" || raw === "SHORT") return "SHORT";

    // Check journal title
    const titleUpper = (journalEntry?.title ?? "").toUpperCase();
    if (titleUpper.includes("BUY") || titleUpper.includes("LONG")) return "LONG";
    if (titleUpper.includes("SELL") || titleUpper.includes("SHORT")) return "SHORT";

    // Heuristic inference from prices & outcome
    const entry = parsedEntry?.entryPrice ?? (session?.plan?.entry ? parseFloat(session.plan.entry) : null);
    const exit = parsedEntry?.exitPrice ?? null;
    const profit = parsedEntry?.profit ?? (journalEntry?.result === "win" ? 1 : journalEntry?.result === "loss" ? -1 : null);
    const stop = parsedEntry?.stopLoss ?? (session?.plan?.stop ? parseFloat(session.plan.stop) : null);

    if (entry != null && exit != null && profit != null) {
      if (profit > 0) return exit >= entry ? "LONG" : "SHORT";
      if (profit < 0) return exit < entry ? "LONG" : "SHORT";
    }

    if (entry != null && stop != null) {
      if (stop < entry) return "LONG";
      if (stop > entry) return "SHORT";
    }

    return "LONG";
  }, [
    parsedEntry?.direction,
    parsedEntry?.entryPrice,
    parsedEntry?.exitPrice,
    parsedEntry?.profit,
    parsedEntry?.stopLoss,
    session?.plan?.decision,
    session?.plan?.entry,
    session?.plan?.stop,
    journalEntry?.title,
    journalEntry?.result,
  ]);

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

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

  // Delta pips / price difference with instrument-aware precision
  const effectiveSymbol = cleanSymbol || "EURUSD";
  const decimals = priceDecimals(effectiveSymbol);
  const formatTradePrice = (val: number | null | undefined) => (val != null ? val.toFixed(decimals) : "—");
  const pipMultiplier = effectiveSymbol.replace("/", "").toUpperCase().includes("JPY")
    ? 100
    : effectiveSymbol.includes("XAU") || effectiveSymbol.includes("GOLD")
      ? 10
      : 10000;
  const priceDelta =
    entryPrice != null && exitPrice != null
      ? (Math.abs(exitPrice - entryPrice) * pipMultiplier).toFixed(1)
      : null;
  const currencySymbol = parsedEntry?.currency ? (parsedEntry.currency.toUpperCase() === "USD" ? "$" : parsedEntry.currency.toUpperCase() === "EUR" ? "€" : parsedEntry.currency) : "€";
  const rMult = parsedEntry ? tradeRMultiple(parsedEntry) : null;
  const executionGrade = isWin ? "A+" : isLoss ? "B" : "A";

  const displayDate = journalEntry?.tradeDate ? journalEntry.tradeDate.slice(0, 10) : session?.day ?? "Data Odierna";
  const displayTime = parsedEntry?.openTime ? parsedEntry.openTime.slice(11, 16) : null;

  const hasStop = Boolean(stopLoss && stopLoss > 0);

  // Smart stop loss calculation (detect absolute price vs offset distance)
  const isStopOffset = useMemo(() => {
    if (!stopLoss || !entryPrice) return false;
    // If entry is > 200 (Gold, SPX, BTC, Nasdaq, etc.) and stopLoss is < 100, it's an offset distance
    if (entryPrice > 200 && stopLoss < 100) return true;
    if (stopLoss < entryPrice * 0.35) return true;
    return false;
  }, [stopLoss, entryPrice]);

  const effectiveStopPrice = useMemo(() => {
    if (!stopLoss) return null;
    if (!isStopOffset || !entryPrice) return stopLoss;
    return isLong ? entryPrice - stopLoss : entryPrice + stopLoss;
  }, [stopLoss, isStopOffset, entryPrice, isLong]);

  const stopDistanceFormatted = useMemo(() => {
    if (!stopLoss) return null;
    if (isStopOffset) return `${stopLoss.toFixed(decimals)} pts`;
    if (entryPrice) return `${Math.abs(entryPrice - stopLoss).toFixed(decimals)} pts`;
    return null;
  }, [stopLoss, isStopOffset, entryPrice, decimals]);

  // Smart take profit calculation (detect absolute price vs offset distance)
  const isTakeProfitOffset = useMemo(() => {
    if (!takeProfit || !entryPrice) return false;
    if (entryPrice > 200 && takeProfit < 100) return true;
    if (takeProfit < entryPrice * 0.35) return true;
    return false;
  }, [takeProfit, entryPrice]);

  const effectiveTakeProfit = useMemo(() => {
    if (!takeProfit) return null;
    if (!isTakeProfitOffset || !entryPrice) return takeProfit;
    return isLong ? entryPrice + takeProfit : entryPrice - takeProfit;
  }, [takeProfit, isTakeProfitOffset, entryPrice, isLong]);

  const targetDistanceFormatted = useMemo(() => {
    if (!takeProfit) return null;
    if (isTakeProfitOffset) return `+${takeProfit.toFixed(decimals)} pts`;
    if (entryPrice) return `+${Math.abs(takeProfit - entryPrice).toFixed(decimals)} pts`;
    return null;
  }, [takeProfit, isTakeProfitOffset, entryPrice, decimals]);

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
    const set = new Set(parsed);
    if (
      parsed.some((t) => t === "respiro-478" || t === "respiro" || t === "calma") ||
      (journalEntry.content ?? "").toLowerCase().includes("respiro tattico")
    ) {
      set.add("calma");
    }
    return set;
  }, [journalEntry?.tags, journalEntry?.content]);

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
    const isCalmToggle = tagLower === "calma" || tagLower === "respiro-478" || tagLower === "respiro";
    const exists = currentTagsList.some((t) => {
      const lower = t.toLowerCase();
      if (isCalmToggle) {
        return lower === "calma" || lower === "respiro-478" || lower === "respiro";
      }
      return lower === tagLower;
    });

    const updatedList = exists
      ? currentTagsList.filter((t) => {
          const lower = t.toLowerCase();
          if (isCalmToggle) {
            return lower !== "calma" && lower !== "respiro-478" && lower !== "respiro";
          }
          return lower !== tagLower;
        })
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
      console.warn("Rete non disponibile: accodamento modifica tag in IndexedDB", err);
      try {
        await queueOfflineMutation({
          type: "update_tags",
          entryId: journalEntry.id,
          payload: {
            title: journalEntry.title,
            content: journalEntry.content ?? "",
            tradeDate: journalEntry.tradeDate,
            result: journalEntry.result,
            tags: newTagsString,
          },
        });
      } catch (queueErr) {
        console.error("Failed to queue offline tags update:", queueErr);
      }
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
      console.warn("Rete non disponibile: accodamento nota in IndexedDB", err);
      try {
        const trimmedNote = localNote.trim();
        await queueOfflineMutation({
          type: "update_note",
          entryId: journalEntry.id,
          payload: {
            title: journalEntry.title,
            content: trimmedNote,
            tradeDate: journalEntry.tradeDate,
            result: journalEntry.result,
            tags: journalEntry.tags ?? null,
          },
        });
        setNoteSavedFeedback(true);
        setTimeout(() => setNoteSavedFeedback(false), 2500);
      } catch (queueErr) {
        console.error("Failed to save note offline:", queueErr);
      }
    } finally {
      setIsSavingNote(false);
    }
  };

  // Dynamic Algorithmic Post-Mortem (Verdetto Tattico Sovrano)
  const verdettoTattico = useMemo(() => {
    const pnlStr = pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "";
    const rStr = rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "";
    const stopDisplay = effectiveStopPrice != null ? formatTradePrice(effectiveStopPrice) : stopLoss != null ? formatTradePrice(stopLoss) : "Livello";

    if (isWin) {
      if (hasStop) {
        return {
          badge: "VITTORIA CONFORME",
          type: "success" as const,
          riskStatus: `Stop a ${stopDisplay}`,
          executionStatus: "Rischio Circoscritto",
          summary: "Esecuzione da manuale: stop inserito a mercato prima dell'apertura ed espansione a target.",
          text: `Operazione conforme al protocollo. Rischio circoscritto prima dell'apertura con stop a ${stopDisplay}, estensione favorevole che ha consentito una chiusura monetaria netta di ${pnlStr || "profitto"}${rStr ? ` (${rStr})` : ""}. Nessuna deviazione strutturale rilevata.`,
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
          riskStatus: `Stop a ${stopDisplay}`,
          executionStatus: "Rischio Reciso",
          summary: "Stop loss da manuale: perdita delimitata sul nascere senza trascinamento emotivo del capitale.",
          text: `Perdita da manuale operativo. Lo stop loss prefissato a ${stopDisplay} ha reciso il rischio sul nascere (${pnlStr || "loss"}${rStr ? `, ${rStr}` : ""}). Il capitale operativo è rimasto intatto senza trascinamento emotivo.`,
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
      riskStatus: hasStop ? `Stop a ${stopDisplay}` : "Break Even",
      executionStatus: "Capitale Preservato",
      summary: "Chiusura neutrale di salvaguardia: liquidità e stabilità mentale preservate per la prossima finestra.",
      text: `Chiusura neutrale di salvaguardia (${pnlStr || "0.00€"}). Il rischio è stato azzerato tempestivamente preservando la liquidità e la stabilità psicologica per la prossima finestra.`,
    };
  }, [isWin, isLoss, hasStop, stopLoss, effectiveStopPrice, pnl, rMult, formatTradePrice]);

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
    if (activeTags.has("calma")) score = Math.min(100, score + 10);
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

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [breathModalOpen, setBreathModalOpen] = useState(false);
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [bioTensionModalOpen, setBioTensionModalOpen] = useState(false);
  const [inlineTelemetryView, setInlineTelemetryView] = useState<"corridor" | "bpm">("corridor");

  const { data: allJournalEntries } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), staleTime: 60_000 },
  });

  const honorCardData: HonorCardData | null = useMemo(() => {
    if (!journalEntry && !session) return null;
    const title = effectiveSymbol || journalEntry?.title || "ESECUZIONE SOVRANA";
    const profitFormatted = pnl != null
      ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`
      : rMult != null
      ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R`
      : "+1.00R";

    return {
      title: `IL LIBRO DELLA VERITÀ · ${title}`,
      subtitle: direction ? `${direction.toUpperCase()} · Esecuzione Disciplinata` : "Operazione Sigillata nel Protocollo",
      operatorName: "Iniziato Aureus",
      asset: effectiveSymbol || "XAU/USD",
      winRate: isWin ? 100 : isLoss ? 0 : 50,
      winTrades: isWin ? 1 : 0,
      totalTrades: 1,
      drawdown: isLoss && pnl ? Math.abs(pnl) : 0,
      maxAllowedDrawdown: 10,
      totalProfitFormatted: profitFormatted,
      integrityScore,
      isDisqualified: !hasStop,
      seasonLabel: "LIBRO DELLA VERITÀ",
      timestamp: displayDate || new Date().toISOString(),
    };
  }, [journalEntry, session, effectiveSymbol, pnl, rMult, direction, isWin, isLoss, hasStop, integrityScore, displayDate]);

  const bioTradeData: TradeBioTelemetryData = useMemo(() => {
    return {
      symbol: cleanSymbol,
      direction,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      pnl,
      rMultiple: rMult,
      duration,
      isWin,
      isLoss,
      tags: Array.from(activeTags),
      openTime: displayDate,
      closeTime: displayDate,
    };
  }, [cleanSymbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, pnl, rMult, duration, isWin, isLoss, activeTags, displayDate]);

  return (
    <div className={cn("flex flex-col h-full min-h-0 overflow-hidden bg-surface-1 rounded-2xl border border-border-subtle shadow-xl select-none p-3 gap-2.5", className)}>
      {/* ── TOP CONTROL BAR: DUAL PERSPECTIVE SWITCHER (STORICO vs IL VARCO LIVE) & HISTORICAL STEPPER ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2/60 p-0.5 text-xs font-mono shrink-0">
          <button
            type="button"
            onClick={() => setInspectorMode("dossier")}
            className={cn(
              "px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
              inspectorMode === "dossier"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            <img src="/images/emblems/dossier.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
            <span className="whitespace-nowrap">Dossier Storico</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorMode("varco")}
            className={cn(
              "px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
              inspectorMode === "varco"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                hasLiveVarco ? "animate-ping bg-emerald-400" : "bg-text-lo/40"
              )} />
              <span className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                hasLiveVarco ? "bg-emerald-500" : "bg-text-lo/60"
              )} />
            </span>
            <span className="whitespace-nowrap">Il Varco {hasLiveVarco ? "(Live)" : ""}</span>
          </button>
        </div>

        {/* Historical Trade Stepper Navigator (< Trade 14 di 26 >) - Fully Visible & Never Compressed */}
        {inspectorMode === "dossier" ? (
          totalTrades > 0 && (
            <div className="flex items-center gap-1 font-mono text-[11px] shrink-0 bg-surface-2/80 px-2 py-0.5 rounded-lg border border-border-subtle shadow-xs">
              <button
                type="button"
                disabled={tradeIndex <= 0}
                onClick={() => onNavigateTrade?.("prev")}
                className="flex h-5 w-5 items-center justify-center rounded border border-border-subtle bg-surface-1 text-text-lo hover:text-text-hi disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
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
                className="flex h-5 w-5 items-center justify-center rounded border border-border-subtle bg-surface-1 text-text-lo hover:text-text-hi disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Trade Successivo"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )
        ) : (
          /* Live Varco Status Pill */
          <span className="font-mono text-[10px] text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded font-bold flex items-center gap-1 whitespace-nowrap">
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
          {/* Header Strip with Asset, Direction, Hero PnL & Action Triggers */}
          <div className="shrink-0 flex items-center justify-between gap-2 bg-surface-0/70 rounded-xl border border-border-subtle/80 p-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-bold text-text-hi whitespace-nowrap">
                {cleanSymbol}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9.5px] font-mono font-bold border whitespace-nowrap tracking-wider uppercase",
                  isLong
                    ? "border-success/30 bg-success/15 text-success"
                    : isShort
                    ? "border-destructive/30 bg-destructive/15 text-destructive"
                    : "border-border-subtle text-text-lo"
                )}
              >
                {isLong ? <ArrowUpRight size={11} /> : isShort ? <ArrowDownRight size={11} /> : null}
                <span className="whitespace-nowrap">{direction}</span>
              </span>
              <span className="font-mono text-[10px] text-text-lo truncate">
                {displayDate} {displayTime ? `· ${displayTime}` : ""}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap",
                  executionGrade.startsWith("A")
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-[#C5A059]/40 bg-[#C5A059]/15 text-[#D4AF37]"
                )}
              >
                GRADO {executionGrade}
              </span>
              <span
                className={cn(
                  "font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shadow-xs whitespace-nowrap",
                  pnl != null && pnl > 0
                    ? "border-success/40 bg-success/20 text-success"
                    : pnl != null && pnl < 0
                    ? "border-destructive/40 bg-destructive/20 text-destructive"
                    : "border-border-subtle text-text-lo bg-surface-2"
                )}
              >
                {pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} €` : "0.00 €"}
              </span>

              {/* Sigillo del Trade Trigger Button */}
              {honorCardData && (
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] hover:bg-[#C5A059]/25 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-[0_0_10px_rgba(197,160,89,0.15)] cursor-pointer"
                  title="Genera e scarica la Scheda d'Onore / Pergamena d'Oro di questo trade"
                >
                  <Award size={12} className="text-[#E8C56A]" />
                  <span>Sigillo del Trade</span>
                </button>
              )}

              {/* Replay Termobarico (BPM) Trigger Button */}
              <button
                type="button"
                onClick={() => setBioTensionModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/15 text-rose-300 hover:bg-[#ef4444]/25 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-[0_0_10px_rgba(239,68,68,0.15)] cursor-pointer"
                title="Analisi Termobarica: Frequenza cardiaca e tenuta psicofisica durante il trade"
              >
                <Heart size={12} className="text-[#ef4444] animate-pulse" />
                <span>Replay Termobarico (BPM)</span>
              </button>
            </div>
          </div>

          {/* Block 1: Tactical Price Coordinates, Visual Evidence & Precision Radar */}
          <div className="flex flex-col rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 shadow-inner overflow-hidden shrink-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <img src="/images/emblems/dottrina.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi whitespace-nowrap">
                  Coordinate di Esecuzione
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-white/10 bg-surface-2 p-0.5 text-[9px] font-mono">
                  <button
                    type="button"
                    onClick={() => setInlineTelemetryView("corridor")}
                    className={cn(
                      "px-1.5 py-0.5 rounded transition-all whitespace-nowrap cursor-pointer",
                      inlineTelemetryView === "corridor"
                        ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                        : "text-text-lo hover:text-text-hi"
                    )}
                  >
                    Corridoio
                  </button>
                  <button
                    type="button"
                    onClick={() => setInlineTelemetryView("bpm")}
                    className={cn(
                      "px-1.5 py-0.5 rounded transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer",
                      inlineTelemetryView === "bpm"
                        ? "bg-[#ef4444]/20 text-rose-300 font-bold border border-[#ef4444]/40"
                        : "text-text-lo hover:text-text-hi"
                    )}
                  >
                    <Heart size={8} className="text-[#ef4444]" />
                    <span>BPM</span>
                  </button>
                </div>

                {priceDelta && (
                  <span className="font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 px-1.5 py-0.2 rounded border border-[#C5A059]/25 font-bold whitespace-nowrap">
                    DELTA: {priceDelta} PUNTI
                  </span>
                )}
                {firstImage && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(0)}
                    className="flex items-center gap-1.5 font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 hover:bg-[#C5A059]/20 px-2 py-0.5 rounded border border-[#C5A059]/30 hover:border-[#C5A059]/70 transition-all cursor-zoom-in group/img whitespace-nowrap"
                    title="Visualizza screenshot ad alta risoluzione"
                  >
                    <img
                      src={firstImage.url}
                      alt="Thumbnail"
                      className="w-3.5 h-3.5 rounded-xs object-cover border border-[#C5A059]/30 group-hover/img:scale-110 transition-transform shrink-0"
                    />
                    <span className="font-semibold whitespace-nowrap">Snapshot HD</span>
                    {totalImagesCount > 1 && (
                      <span className="text-[8px] bg-black/60 px-1 rounded text-white/70">
                        +{totalImagesCount - 1}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Visual Evidence Theater: 16:9 Prominent Snapshot vs Dynamic Vector Corridor vs BPM Replay */}
            {inlineTelemetryView === "bpm" ? (
              <div className="w-full h-32 sm:h-36 overflow-hidden flex items-center justify-center p-0.5 my-1.5 rounded-lg border border-border-subtle/50 bg-surface-2/40">
                <DisciplineBioTensionChart
                  compact
                  trade={bioTradeData}
                  onOpenTacticalBreath={() => setBreathModalOpen(true)}
                  className="w-full h-full border-none bg-transparent p-1 shadow-none"
                />
              </div>
            ) : firstImage ? (
              <div
                onClick={() => setLightboxIndex(0)}
                className="relative w-full h-32 sm:h-36 rounded-lg overflow-hidden border border-[#C5A059]/35 hover:border-[#C5A059] bg-black/80 group/snap cursor-zoom-in my-1.5 shrink-0 transition-all shadow-md"
                title="Clicca per ingrandire lo screenshot ad alta risoluzione"
              >
                <img
                  src={firstImage.url}
                  alt="Screenshot trade"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/snap:scale-102"
                />
                {/* Top overlay badge */}
                <div className="absolute top-1.5 left-2 flex items-center gap-1.5 bg-black/85 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10 font-mono text-[9px] shadow-sm">
                  <Activity size={10} className="text-[#C5A059]" />
                  <span className="text-white font-bold whitespace-nowrap">Corridoio di Volatilità: {cleanSymbol} ({direction})</span>
                </div>
                {/* Center hover prompt */}
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/snap:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-black/90 px-3 py-1 rounded-lg border border-[#C5A059]/60 flex items-center gap-1.5 text-white font-mono text-[10px] shadow-lg">
                    <Maximize2 size={13} className="text-[#E8C56A]" />
                    <span className="font-bold">Ingrandisci Snapshot HD</span>
                  </div>
                </div>
                {/* Bottom strip */}
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between bg-black/85 backdrop-blur-xs px-2.5 py-0.5 rounded border border-white/10 font-mono text-[9px] text-text-lo shadow-sm">
                  <span className="truncate pr-2">
                    {entryPrice && exitPrice
                      ? `Esecuzione: ${formatTradePrice(entryPrice)} → ${formatTradePrice(exitPrice)} (${priceDelta} pips)`
                      : "Operazione eseguita e consolidata a mercato"}
                  </span>
                  <span className="text-[#E8C56A] font-bold whitespace-nowrap">
                    Rapporto R:R: {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "1.0R Normativo"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-24 rounded-lg border border-border-subtle/50 bg-surface-2/40 px-3 py-1.5 flex items-center justify-between my-1.5 shrink-0">
                <div className="flex flex-col justify-center font-mono text-[10px] space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 text-text-hi font-bold">
                    <Activity size={12} className="text-[#C5A059]" />
                    <span className="truncate">Corridoio di Volatilità: {cleanSymbol} ({direction})</span>
                  </div>
                  <span className="text-[9px] text-text-lo truncate">
                    {entryPrice && exitPrice
                      ? `Esecuzione: ${formatTradePrice(entryPrice)} → ${formatTradePrice(exitPrice)} (${priceDelta} pips)`
                      : "Operazione eseguita e consolidata a mercato"}
                  </span>
                  <span className="text-[9px] text-[#C5A059] whitespace-nowrap">
                    Rapporto R:R Conseguito: {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "1.0R Normativo"}
                  </span>
                </div>

                {/* Dynamic SVG Price Trajectory Vector */}
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
              </div>
            )}

            {/* Unified 6-Box High-Density Precision Telemetry Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono text-[11px] pt-1.5 border-t border-white/[0.06] shrink-0">
              <div className="rounded bg-surface-2/80 border border-border-subtle p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-[#C5A059] font-semibold block whitespace-nowrap">Entry</span>
                <span className="text-text-hi font-bold text-xs truncate block whitespace-nowrap">
                  {formatTradePrice(entryPrice)}
                </span>
              </div>

              <div className="rounded bg-surface-2/80 border border-border-subtle p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-text-lo font-semibold block whitespace-nowrap">Exit</span>
                <span className="text-text-hi font-bold text-xs truncate block whitespace-nowrap">
                  {formatTradePrice(exitPrice)}
                </span>
              </div>

              <div className="rounded bg-destructive/10 border border-destructive/20 p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-destructive font-semibold block whitespace-nowrap">Stop Loss</span>
                <span className="text-destructive font-bold text-xs truncate block whitespace-nowrap">
                  {effectiveStopPrice ? formatTradePrice(effectiveStopPrice) : (stopLoss ? formatTradePrice(stopLoss) : "Strutturale")}
                </span>
                {stopDistanceFormatted && (
                  <span className="text-[7.5px] text-destructive/80 font-mono block whitespace-nowrap">
                    -{stopDistanceFormatted}
                  </span>
                )}
              </div>

              <div className="rounded bg-success/10 border border-success/20 p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-success font-semibold block whitespace-nowrap">Target</span>
                <span className="text-success font-bold text-xs truncate block whitespace-nowrap">
                  {effectiveTakeProfit ? formatTradePrice(effectiveTakeProfit) : (takeProfit ? formatTradePrice(takeProfit) : "Dinamico")}
                </span>
                {targetDistanceFormatted && (
                  <span className="text-[7.5px] text-success/80 font-mono block whitespace-nowrap">
                    {targetDistanceFormatted}
                  </span>
                )}
              </div>

              <div className="rounded bg-surface-2/80 border border-border-subtle p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-[#C5A059] font-semibold block whitespace-nowrap">Rapporto R:R</span>
                <span className={cn(
                  "font-bold text-xs truncate block whitespace-nowrap",
                  isWin ? "text-success" : isLoss ? "text-destructive" : "text-[#C5A059]"
                )}>
                  {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "1.0R"}
                </span>
              </div>

              <div className="rounded bg-surface-2/80 border border-border-subtle p-1.5 text-center">
                <span className="text-[7.5px] uppercase tracking-wider text-text-lo font-semibold block whitespace-nowrap">Volume & Netto</span>
                <span className="text-text-hi font-bold text-xs truncate block whitespace-nowrap">
                  {volume} lot
                </span>
                <span className="text-[7.5px] text-text-lo/80 block whitespace-nowrap">
                  {(commission + swap).toFixed(2)}€
                </span>
              </div>
            </div>
          </div>

          {/* Block 2: Sovereign Truth, Dynamic Cognitive Audit & Discipline (~58% height, fully saturated) */}
          <div className="flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 sm:p-3 shadow-inner overflow-hidden select-none">
            {/* Header Strip with Emblem, Badges & Integrated Integrity Barometer */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/[0.06] pb-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <img src="/images/emblems/libro-della-verita.png" alt="" className="w-4 h-4 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(197,160,89,0.4)]" />
                <span className="font-mono text-xs sm:text-[13px] font-bold uppercase tracking-wider text-text-hi whitespace-nowrap">
                  Disciplina &amp; Consolidamento
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                {hasStop ? (
                  <span className="rounded-lg bg-success/15 border border-success/35 px-2 py-0.5 text-success font-bold flex items-center gap-1 shadow-xs">
                    <Check size={11} />
                    <span>STOP PROTETTO</span>
                  </span>
                ) : (
                  <span className="rounded-lg bg-destructive/15 border border-destructive/35 px-2 py-0.5 text-destructive font-bold flex items-center gap-1 animate-pulse shadow-xs">
                    <AlertTriangle size={11} />
                    <span>NO STOP LOSS</span>
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-lg border px-2 py-0.5 font-bold shadow-xs whitespace-nowrap",
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
                    "rounded-lg border px-2 py-0.5 font-bold flex items-center gap-1 shadow-xs whitespace-nowrap",
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
            <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar scrollbar-thin scrollbar-thumb-[#C5A059]/30 min-h-0 py-2 pr-1">
              {/* Anti-Tilt Reset Banner if Loss or No Stop */}
              {(isLoss || !hasStop) && (
                <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-destructive/40 bg-destructive/10 shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wind size={16} className="text-destructive shrink-0 animate-pulse" />
                    <span className="text-xs font-mono font-medium text-destructive/95 truncate">
                      {isLoss ? "Perdita registrata: azzera il cortisolo con il ritmo vitale." : "Stop mancante: riallinea la disciplina al protocollo."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBreathModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/20 hover:bg-[#C5A059]/35 text-[#F3D88C] font-mono text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer whitespace-nowrap shadow-[0_0_10px_rgba(197,160,89,0.25)] transition-all"
                  >
                    <Wind size={13} className="text-[#E8C56A]" />
                    <span>Respiro 4-7-8</span>
                  </button>
                </div>
              )}

              {/* Module A: Structured Diagnostic Telemetry */}
              <div
                className={cn(
                  "rounded-xl border p-2.5 font-mono text-xs transition-all flex flex-col gap-2 shadow-sm",
                  verdettoTattico.type === "success"
                    ? "border-success/30 bg-success/[0.04]"
                    : verdettoTattico.type === "warning" || verdettoTattico.type === "danger"
                    ? "border-destructive/30 bg-destructive/[0.04]"
                    : "border-border-subtle/80 bg-surface-2/40"
                )}
              >
                {/* Header row: Badge + Verdetto Algoritmico label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-xs",
                        verdettoTattico.type === "success"
                          ? "border-success/40 bg-success/20 text-success"
                          : verdettoTattico.type === "warning" || verdettoTattico.type === "danger"
                          ? "border-destructive/40 bg-destructive/20 text-destructive"
                          : "border-[#C5A059]/40 bg-[#C5A059]/20 text-[#D4AF37]"
                      )}
                    >
                      {verdettoTattico.type === "success" ? (
                        <ShieldCheck size={12} />
                      ) : verdettoTattico.type === "danger" || verdettoTattico.type === "warning" ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      <span>{verdettoTattico.badge}</span>
                    </span>
                    <span className="text-xs text-text-lo/90 font-bold uppercase tracking-wider">
                      Verdetto Algoritmico
                    </span>
                  </div>

                  <span className="text-xs text-text-lo font-mono">
                    {displayDate}
                  </span>
                </div>

                {/* 3 Telemetry Data Cells: Stop, Qualità, Esito */}
                <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                  <div className="bg-surface-1/90 border border-border-subtle/70 rounded-lg p-1.5 text-center shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-text-lo/80 block font-semibold">Protezione Stop</span>
                    <strong className={cn("text-xs sm:text-[13px] truncate block font-bold mt-0.5", hasStop ? "text-success" : "text-destructive")}>
                      {verdettoTattico.riskStatus}
                    </strong>
                  </div>
                  <div className="bg-surface-1/90 border border-border-subtle/70 rounded-lg p-1.5 text-center shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-text-lo/80 block font-semibold">Esecuzione</span>
                    <strong className="text-xs sm:text-[13px] text-text-hi truncate block font-bold mt-0.5">
                      {verdettoTattico.executionStatus}
                    </strong>
                  </div>
                  <div className="bg-surface-1/90 border border-border-subtle/70 rounded-lg p-1.5 text-center shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-text-lo/80 block font-semibold">Rendimento</span>
                    <strong className={cn("text-xs sm:text-[13px] truncate block font-bold mt-0.5", isWin ? "text-success" : isLoss ? "text-destructive" : "text-[#C5A059]")}>
                      {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "Normativo"}
                    </strong>
                  </div>
                </div>

                {/* High-signal 1-line verdict (scannable, no fluff) */}
                <p className="text-xs sm:text-[12.5px] text-text-hi/95 leading-relaxed bg-surface-1/70 rounded-lg px-2.5 py-1.5 border border-white/[0.04]">
                  {verdettoTattico.summary}
                </p>
              </div>

              {/* Module B: Interactive Cognitive & Emotional Audit (3D Tactile Console) */}
              <div className="rounded-xl border border-border-subtle/80 bg-surface-2/40 p-2.5 sm:p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={15} className="text-[#C5A059]" />
                    <span className="text-xs sm:text-[13px] font-mono font-bold uppercase tracking-wider text-text-hi">
                      Audit Emotivo &amp; Bias Rilevato
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRadarModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] hover:bg-[#C5A059]/25 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Compass size={12} />
                    <span>Mappa Virtù &amp; Leak</span>
                  </button>
                </div>

                {/* Sub-block B1: Virtù di Disciplina */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-success font-bold">
                    <ShieldCheck size={13} className="text-success" />
                    <span>Virtù Esecutive</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {VIRTU_TAGS.map((tag) => {
                      const isActive = activeTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            "relative flex flex-col items-center justify-center text-center p-2 rounded-xl transition-all border group/card cursor-pointer select-none",
                            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] active:scale-[0.98]",
                            isActive
                              ? "bg-gradient-to-b from-emerald-500/25 to-emerald-950/40 border-emerald-400/80 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.32),inset_0_1px_2px_rgba(255,255,255,0.25)]"
                              : "bg-surface-1/90 border-border-subtle/80 hover:border-white/20 text-text-lo hover:text-text-hi hover:bg-surface-2/60"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-sm mb-1 transition-transform group-hover/card:scale-110",
                            isActive
                              ? "bg-emerald-500/30 border border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              : "bg-surface-2 border border-white/10"
                          )}>
                            <span>{tag.icon}</span>
                          </div>
                          <span className={cn(
                            "text-xs font-bold block leading-tight",
                            isActive ? "text-emerald-300" : "text-text-hi"
                          )}>
                            {tag.label}
                          </span>
                          <span className="text-[9.5px] font-mono text-text-lo/70 block mt-0.5">
                            {tag.desc}
                          </span>
                          {isActive && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-block B2: Leak & Bias Operativi */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-rose-300 font-bold">
                    <AlertTriangle size={13} className="text-destructive/90" />
                    <span>Leak &amp; Bias Rilevati</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {LEAK_TAGS.map((tag) => {
                      const isActive = activeTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            "relative flex flex-col items-center justify-center text-center p-2 rounded-xl transition-all border group/card cursor-pointer select-none",
                            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] active:scale-[0.98]",
                            isActive
                              ? "bg-gradient-to-b from-rose-500/25 to-rose-950/40 border-rose-400/80 text-rose-200 shadow-[0_0_14px_rgba(239,68,68,0.32),inset_0_1px_2px_rgba(255,255,255,0.25)]"
                              : "bg-surface-1/90 border-border-subtle/80 hover:border-white/20 text-text-lo hover:text-text-hi hover:bg-surface-2/60"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-sm mb-1 transition-transform group-hover/card:scale-110",
                            isActive
                              ? "bg-rose-500/30 border border-rose-400/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                              : "bg-surface-2 border border-white/10"
                          )}>
                            <span>{tag.icon}</span>
                          </div>
                          <span className={cn(
                            "text-xs font-bold block leading-tight",
                            isActive ? "text-rose-300" : "text-text-hi"
                          )}>
                            {tag.label}
                          </span>
                          <span className="text-[9.5px] font-mono text-text-lo/70 block mt-0.5">
                            {tag.desc}
                          </span>
                          {isActive && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Module C: Dynamic Rule for Tomorrow (Imperial Gold Decree) */}
              <div className="rounded-xl bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/10 to-surface-2/60 border border-[#C5A059]/40 p-3 flex items-start gap-3 shadow-md">
                <div className="w-8 h-8 rounded-lg bg-[#C5A059]/25 border border-[#C5A059]/50 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(197,160,89,0.3)]">
                  <Target size={18} className="text-[#E8C56A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-mono uppercase tracking-wider font-bold text-[#E8C56A]">
                    Regola Consolidata per Domani:
                  </span>
                  <p className="text-white text-xs sm:text-[13px] leading-relaxed mt-1 font-medium">
                    {regolaConsolidata}
                  </p>
                </div>
              </div>

              {/* Module D: Personal Inline Debrief Editor with Tactile Chips */}
              <div className="rounded-xl border border-border-subtle/80 bg-surface-2/40 p-2.5 sm:p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                  <div className="flex items-center gap-2">
                    <PenLine size={14} className="text-[#C5A059]" />
                    <span className="text-xs sm:text-[13px] font-mono font-bold uppercase tracking-wider text-text-hi">
                      Annotazione Tattica Personale
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingNote}
                    onClick={handleSaveNote}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer shadow-xs",
                      noteSavedFeedback
                        ? "bg-success/20 border-success/40 text-success"
                        : "bg-[#C5A059]/25 hover:bg-[#C5A059]/35 border-[#C5A059]/50 text-[#F3D88C]"
                    )}
                  >
                    {noteSavedFeedback ? (
                      <>
                        <Check size={12} />
                        <span>Salvato</span>
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        <span>{isSavingNote ? "Salvataggio..." : "Salva Debrief"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick starter chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-xs font-mono text-text-lo/80 uppercase font-semibold">Spunti:</span>
                  {[
                    { label: "✓ Setup A+ a Piano", text: "Setup A+ eseguito rigorosamente a piano." },
                    { label: "⏳ Pazienza Attesa", text: "Atteso il trigger di conferma senza fretta." },
                    { label: "⚠ Uscita per Ansia", text: "Uscita chiusa prima del target per ansia." },
                    { label: "⚠ Stop Troppo Stretto", text: "Stop loss troppo esposto al rumore di mercato." },
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
                      className="px-2.5 py-1 rounded-lg bg-surface-1 border border-border-subtle hover:border-[#C5A059]/40 text-xs font-mono text-text-lo hover:text-text-hi transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  placeholder="Scrivi le tue considerazioni su questo trade (contesto HTF, trigger, sensazioni a mercato)..."
                  className="w-full min-h-[72px] bg-surface-1/90 border border-border-subtle/80 rounded-xl p-2.5 font-mono text-xs sm:text-[12.5px] text-text-hi placeholder:text-text-lo/40 resize-none focus:outline-none focus:border-[#C5A059]/80 focus:ring-1 focus:ring-[#C5A059]/30 leading-relaxed"
                />
              </div>
            </div>

            {/* Module E: Protocol Integrity Barometer Footer */}
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-text-lo shrink-0">
              <div className="flex items-center gap-2">
                <span>Integrità Esecutiva:</span>
                <div className="w-24 h-2 rounded-full bg-surface-2 overflow-hidden border border-border-subtle/70 flex">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      integrityScore >= 80 ? "bg-success" : integrityScore >= 50 ? "bg-[#C5A059]" : "bg-destructive"
                    )}
                    style={{ width: `${integrityScore}%` }}
                  />
                </div>
                <strong className={cn("text-xs sm:text-sm font-bold", integrityScore >= 80 ? "text-success" : integrityScore >= 50 ? "text-[#C5A059]" : "text-destructive")}>
                  {integrityScore}%
                </strong>
              </div>
              <span className="font-bold text-xs text-[#C5A059] tracking-wider">REGISTRATO NEL DIARIO</span>
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

      {/* Scheda d'Onore & Pergamena d'Oro Modal */}
      <HonorCardShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={honorCardData}
      />

      {/* Modale del Rituale del Respiro Tattico 4-7-8 */}
      <TacticalBreathModal
        isOpen={breathModalOpen}
        onClose={() => setBreathModalOpen(false)}
      />

      {/* Mappa Radiale Virtù & Leak ne Il Libro della Verità */}
      <DisciplineVirtueRadarModal
        isOpen={radarModalOpen}
        onClose={() => setRadarModalOpen(false)}
        entries={allJournalEntries ?? (journalEntry ? [journalEntry] : [])}
        currentEntry={journalEntry}
      />

      {/* Replay Termobarico & Curva della Tensione nel Libro della Verità */}
      <DisciplineBioTensionModal
        isOpen={bioTensionModalOpen}
        onClose={() => setBioTensionModalOpen(false)}
        trade={bioTradeData}
        onOpenTacticalBreath={() => setBreathModalOpen(true)}
      />
    </div>
  );
});
