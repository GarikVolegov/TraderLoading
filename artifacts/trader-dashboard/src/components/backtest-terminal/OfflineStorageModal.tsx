// ─── AUREUS PROTOCOL — Archivio Locale Offline (IndexedDB Buffer) ───────────────
// Gestione completa dei pacchetti storici archiviati localmente nel browser
// per abilitare il replay e l'esecuzione matematica dei trade anche in totale
// assenza di connessione internet (zero dipendenza server / zero latenza).

import React, { useEffect, useRef, useState } from "react";
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  Play,
  X,
  ShieldCheck,
  Loader2,
  Calendar,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  deleteOfflineReplaySession,
  downloadAndBufferOfflinePack,
  exportOfflineSessionJson,
  getStorageQuotaEstimate,
  importOfflineSessionJson,
  listOfflineReplaySessions,
  requestStoragePersistence,
  type OfflineReplaySession,
  type StorageQuotaEstimate,
} from "@/lib/replayOfflineBuffer";
import type { ReplayEngine } from "./useReplayEngine";

const ALL_SYMBOLS = [
  "BTCUSD", "ETHUSD", "XAUUSD", "EURUSD", "USOIL", "GBPUSD", "USDJPY",
  "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "EURGBP", "EURJPY", "GBPJPY",
  "AUDJPY", "US30", "NAS100", "SPX500",
] as const;

const AVAILABLE_TIMEFRAMES = ["M1", "M5", "M15", "H1", "D1", "W1"] as const;

const CHRONOS_OPTIONS = [
  { value: "ALL", label: "Intero Storico (2020 — 2026)" },
  { value: "2026", label: "Anno 2026 (In Corso)" },
  { value: "2025", label: "Anno 2025" },
  { value: "2024", label: "Anno 2024" },
  { value: "2023", label: "Anno 2023" },
  { value: "2022", label: "Anno 2022" },
  { value: "2021", label: "Anno 2021" },
  { value: "2020", label: "Anno 2020 (Origine Sovrana)" },
] as const;

export interface OfflineStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: ReplayEngine;
}

export function OfflineStorageModal({ isOpen, onClose, engine }: OfflineStorageModalProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<OfflineReplaySession[]>([]);
  const [quota, setQuota] = useState<StorageQuotaEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form download pacchetto
  const [targetSymbol, setTargetSymbol] = useState(engine.symbol.replace("/", "").toUpperCase());
  const [targetInterval, setTargetInterval] = useState(engine.interval);
  const [targetSpan, setTargetSpan] = useState<string>("2024");
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<{ loadedBars: number; pct: number; currentTs?: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [list, q] = await Promise.all([
        listOfflineReplaySessions(),
        getStorageQuotaEstimate(),
      ]);
      setSessions(list);
      setQuota(q);
    } catch {
      // no-op
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  // Gestione chiusura tasto Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDownloading && abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDownloading, onClose]);

  if (!isOpen) return null;

  const handleDownloadPack = async () => {
    setIsDownloading(true);
    setProgress({ loadedBars: 0, pct: 0 });
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let fromTs: number;
      let toTs: number;
      const nowTs = Math.floor(Date.now() / 1000);

      if (targetSpan === "ALL") {
        fromTs = Date.UTC(2020, 0, 1) / 1000;
        toTs = nowTs;
      } else {
        const y = Number(targetSpan);
        fromTs = Date.UTC(y, 0, 1) / 1000;
        toTs = Math.min(nowTs, Date.UTC(y + 1, 0, 1) / 1000);
      }

      const pack = await downloadAndBufferOfflinePack(
        {
          symbol: targetSymbol,
          interval: targetInterval,
          from: fromTs,
          to: toTs,
        },
        {
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        },
      );

      toast({
        title: "Archivio Offline Forgiato",
        description: `${pack.name} (${pack.barCount.toLocaleString()} candele) registrato nel buffer locale.`,
      });

      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof DOMException && err.name === "AbortError") {
        toast({
          title: "Download Annullato",
          description: "L'operazione di bufferizzazione è stata interrotta dall'operatore.",
        });
      } else {
        toast({
          title: "Errore Download Pacchetto",
          description: msg || "Impossibile completare il download dello storico.",
          variant: "destructive",
        });
      }
    } finally {
      setIsDownloading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleTogglePersistence = async () => {
    const granted = await requestStoragePersistence();
    if (granted) {
      toast({
        title: "Persistenza Sovrana Attiva",
        description: "Il browser proteggerà il buffer offline da cancellazioni automatiche.",
      });
    } else {
      toast({
        title: "Persistenza Limitata",
        description: "Il browser gestisce lo storage con policy standard o non supporta la richiesta.",
      });
    }
    await loadData();
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteOfflineReplaySession(id);
    toast({
      title: "Pacchetto Eliminato",
      description: `"${name}" rimosso dal buffer locale.`,
    });
    await loadData();
  };

  const handleExport = (session: OfflineReplaySession) => {
    const jsonStr = exportOfflineSessionJson(session);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AUREUS_${session.symbol}_${session.interval}_${new Date(session.from * 1000).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importOfflineSessionJson(text);
      toast({
        title: "Pacchetto Importato con Successo",
        description: `${imported.name} (${imported.barCount.toLocaleString()} candele) aggiunto all'archivio.`,
      });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Errore Importazione JSON",
        description: msg || "File JSON corrotto o non conforme alle specifiche AUREUS.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLoadSession = (session: OfflineReplaySession) => {
    if (session.interval !== engine.interval) {
      engine.changeInterval(session.interval);
    }
    const dateStr = new Date(session.from * 1000).toISOString().slice(0, 10);
    engine.jumpToDate(dateStr);
    toast({
      title: "Replay Offline Attivato",
      description: `${session.symbol} (${session.interval}) posizionato al ${dateStr}.`,
    });
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-4xl bg-[#0d0f14] border border-[#C5A059]/30 rounded-lg shadow-2xl shadow-black/80 flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-storage-title"
      >
        {/* ── Testata del Cockpit Offline ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#C5A059]/20 bg-[#11131c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#E8C56A]">
              <HardDrive size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="offline-storage-title" className="text-sm font-semibold tracking-wide text-white">
                  Archivio Locale Offline
                </h2>
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]">
                  IndexedDB Resiliente
                </span>
              </div>
              <p className="text-[11px] text-[var(--btm-mut)]">
                Buffer atomico permanente per esecuzione continua e replay a zero latenza.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--btm-mut)] hover:text-white hover:bg-white/5 transition-colors"
            title="Chiudi (Esc)"
            aria-label="Chiudi finestra"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Barra Telemetria & Persistenza ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-2.5 bg-[#090a0e] border-b border-[#C5A059]/15 text-[11px]">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-[#C5A059]" />
            <span className="text-[var(--btm-mut)]">Spazio Occupato:</span>
            <span className="font-mono font-bold text-white whitespace-nowrap">
              {quota ? formatBytes(quota.usedBytes) : "Calcolo..."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Layers size={13} className="text-[#C5A059]" />
            <span className="text-[var(--btm-mut)]">Pacchetti Archiviati:</span>
            <span className="font-mono font-bold text-[#E8C56A] whitespace-nowrap">
              {sessions.length} {sessions.length === 1 ? "Pacchetto" : "Pacchetti"}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck
                size={13}
                className={quota?.persisted ? "text-[#10b981]" : "text-[var(--btm-mut)]"}
              />
              <span className="text-[var(--btm-mut)]">Stato Storage:</span>
              <span
                className={`font-mono text-[10px] font-bold uppercase whitespace-nowrap ${
                  quota?.persisted ? "text-[#10b981]" : "text-[var(--btm-mut)]"
                }`}
              >
                {quota?.persisted ? "Persistente" : "Standard"}
              </span>
            </div>
            {!quota?.persisted && (
              <button
                type="button"
                onClick={handleTogglePersistence}
                className="text-[10px] font-mono font-semibold text-[#E8C56A] hover:underline whitespace-nowrap"
              >
                [Attiva Protezione]
              </button>
            )}
          </div>
        </div>

        {/* ── Corpo Modale (Scrollabile) ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {/* Sezione: Scarica Nuovo Pacchetto */}
          <div className="p-4 rounded-lg bg-[#11131c] border border-[#C5A059]/25 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Download size={14} className="text-[#C5A059]" />
                <h3 className="text-xs font-semibold text-white tracking-wide">
                  Scarica & Archivia Nuovo Pacchetto
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[var(--btm-mut)]">
                Streaming Atomico (Chunks 5.000 M1)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-mono text-[var(--btm-mut)] uppercase tracking-wider mb-1">
                  Strumento Sovrano
                </label>
                <select
                  value={targetSymbol}
                  disabled={isDownloading}
                  onChange={(e) => setTargetSymbol(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-[#0d0f14] border border-[#C5A059]/30 text-white font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                >
                  {ALL_SYMBOLS.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[var(--btm-mut)] uppercase tracking-wider mb-1">
                  Timeframe Base
                </label>
                <select
                  value={targetInterval}
                  disabled={isDownloading}
                  onChange={(e) => setTargetInterval(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-[#0d0f14] border border-[#C5A059]/30 text-white font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                >
                  {AVAILABLE_TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf} {tf === "M1" ? "(Massima Precisione)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[var(--btm-mut)] uppercase tracking-wider mb-1">
                  Orizzonte Cronologico
                </label>
                <select
                  value={targetSpan}
                  disabled={isDownloading}
                  onChange={(e) => setTargetSpan(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-[#0d0f14] border border-[#C5A059]/30 text-white font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                >
                  {CHRONOS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barra di Avanzamento Download Live */}
            {isDownloading && progress && (
              <div className="mb-3 p-3 rounded bg-[#090a0e] border border-[#C5A059]/40 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-[#E8C56A]">
                    <Loader2 size={13} className="animate-spin text-[#C5A059]" />
                    Streaming storico in corso...
                  </span>
                  <span className="text-white whitespace-nowrap">
                    {progress.loadedBars.toLocaleString()} candele ({progress.pct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#C5A059] to-[#E8C56A] transition-all duration-200"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isDownloading}
                  className="h-8 px-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-[var(--btm-mut)] hover:text-white transition-colors flex items-center gap-1.5"
                  title="Importa pacchetto JSON salvato in precedenza"
                >
                  <Upload size={12} />
                  <span>Importa JSON</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isDownloading ? (
                  <button
                    type="button"
                    onClick={handleCancelDownload}
                    className="h-8 px-4 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/50 text-red-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <X size={13} />
                    <span>Annulla Download</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadPack}
                    className="h-8 px-4 rounded bg-[#C5A059] hover:bg-[#E8C56A] text-black font-semibold text-xs font-mono tracking-wide transition-all shadow-md shadow-[#C5A059]/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Archivia nel Buffer Locale</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sezione: Elenco Pacchetti Archiviati */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#C5A059]" />
                <h3 className="text-xs font-semibold text-white tracking-wide">
                  Pacchetti Sovrani Disponibili nel Buffer
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[var(--btm-mut)]">
                {sessions.length} archivi pronti per uso offline
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--btm-mut)] font-mono text-xs">
                <Loader2 size={18} className="animate-spin text-[#C5A059]" />
                <span>Lettura memoria locale IndexedDB...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 rounded-lg bg-[#11131c]/60 border border-white/5 text-center space-y-2">
                <HardDrive size={24} className="mx-auto text-[var(--btm-mut)]" />
                <p className="text-xs font-medium text-white">Nessun pacchetto offline presente</p>
                <p className="text-[11px] text-[var(--btm-mut)] max-w-md mx-auto">
                  Usa il modulo sopra per scaricare uno o più anni di candele storiche. Potrai eseguire replay e simulazioni di trading anche in modalità aereo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((sess) => {
                  const fromDate = new Date(sess.from * 1000).toISOString().slice(0, 10);
                  const toDate = new Date(sess.to * 1000).toISOString().slice(0, 10);
                  const isCurrentSymbol =
                    sess.symbol === engine.symbol.replace("/", "").toUpperCase();

                  return (
                    <div
                      key={sess.id}
                      className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isCurrentSymbol
                          ? "bg-[#11131c] border-[#C5A059]/40 shadow-sm"
                          : "bg-[#0d0f14] border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center w-14 h-11 rounded bg-black/40 border border-[#C5A059]/25 shrink-0">
                          <span className="font-mono text-xs font-bold text-[#E8C56A]">
                            {sess.symbol}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--btm-mut)]">
                            {sess.interval}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white truncate">
                              {sess.name}
                            </span>
                            {isCurrentSymbol && (
                              <span className="font-mono text-[8px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981]">
                                Grafico Attivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--btm-mut)] mt-0.5">
                            <span className="whitespace-nowrap font-medium text-white/80">
                              {fromDate} → {toDate}
                            </span>
                            <span className="whitespace-nowrap">
                              {sess.barCount.toLocaleString()} barre
                            </span>
                            <span className="whitespace-nowrap">
                              ~{formatBytes(sess.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadSession(sess)}
                          className="h-7 px-2.5 rounded bg-[#C5A059]/20 hover:bg-[#C5A059]/35 border border-[#C5A059]/50 text-[#E8C56A] text-[11px] font-mono font-medium transition-colors flex items-center gap-1"
                          title="Carica questo pacchetto nel terminale di replay"
                        >
                          <Play size={11} />
                          <span>Carica Replay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExport(sess)}
                          className="h-7 w-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--btm-mut)] hover:text-white transition-colors flex items-center justify-center"
                          title="Esporta JSON"
                          aria-label={`Esporta ${sess.name} in JSON`}
                        >
                          <FileDown size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(sess.id, sess.name)}
                          className="h-7 w-7 rounded bg-red-950/20 hover:bg-red-950/60 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center"
                          title="Elimina dal buffer locale"
                          aria-label={`Elimina ${sess.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-[#C5A059]/20 bg-[#11131c] flex items-center justify-between text-[11px] text-[var(--btm-mut)]">
          <span className="font-mono text-[10px]">
            AUREUS OFFLINE KERNEL · Zero Rete · 100% Deterministico
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-4 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
