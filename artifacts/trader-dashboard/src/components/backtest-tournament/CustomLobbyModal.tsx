import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { TribePresetsManager } from "./TribePresetsManager";
import {
  createCustomLobby,
  fetchCustomLobbyByCode,
  type BacktestCustomLobby,
  type BacktestTribePreset,
} from "@/lib/backtestTournamentsApi";
import { useToast } from "@/hooks/use-toast";
import {
  Flame,
  Shield,
  Shuffle,
  Users,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";

export interface CustomLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLobbyReady: (lobby: BacktestCustomLobby) => void;
  userDisplayName?: string;
}

export function CustomLobbyModal({
  isOpen,
  onClose,
  onLobbyReady,
  userDisplayName = "Comandante",
}: CustomLobbyModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("Forgia di Battaglia Limen");
  const [pair, setPair] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState("M5");
  const [initialBalance, setInitialBalance] = useState("100000");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("10.00");
  const [targetProfitPct, setTargetProfitPct] = useState("15.00");
  const [maxTrades, setMaxTrades] = useState(50);
  const [hasTimeLimit, setHasTimeLimit] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [randomDates, setRandomDates] = useState(true);
  const [selectedTribePresetId, setSelectedTribePresetId] = useState<number | null>(null);

  // Join by code state
  const [joinCode, setJoinCode] = useState("");

  const handleSelectPreset = (preset: BacktestTribePreset) => {
    setSelectedTribePresetId(preset.id);
    setName(`Forgia · ${preset.tribeName}`);
    setPair(preset.pair);
    setTimeframe(preset.timeframe);
    setInitialBalance(preset.initialBalance);
    setMaxDrawdownPct(preset.maxDrawdownPct);
    setTargetProfitPct(preset.targetProfitPct);
    setMaxTrades(preset.maxTrades);
    if (preset.timeLimitSeconds && preset.timeLimitSeconds > 0) {
      setHasTimeLimit(true);
      setTimeLimitMinutes(Math.round(preset.timeLimitSeconds / 60));
    } else {
      setHasTimeLimit(false);
    }
    setRandomDates(preset.randomDates);
    toast({
      title: "Preset Tribù Applicato",
      description: `Regole impostate per ${preset.tribeName}.`,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createCustomLobby({
        name: name.trim() || "Forgia di Battaglia",
        hostDisplayName: userDisplayName,
        pair,
        timeframe,
        initialBalance,
        maxDrawdownPct,
        targetProfitPct,
        maxTrades,
        timeLimitSeconds: hasTimeLimit ? timeLimitMinutes * 60 : 0,
        randomDates,
        tribePresetId: selectedTribePresetId ?? undefined,
      });

      toast({
        title: "Lobby Forgia Creata!",
        description: `Codice Stanza: ${res.lobby.code}. Accesso alla stanza multiplayer…`,
      });

      onLobbyReady(res.lobby);
      onClose();
    } catch (err) {
      toast({
        title: "Errore creazione stanza",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetchCustomLobbyByCode(joinCode.trim());
      toast({
        title: "Stanza Trovata!",
        description: `Connessione a ${res.lobby.name}…`,
      });
      onLobbyReady(res.lobby);
      onClose();
    } catch (err) {
      toast({
        title: "Stanza non trovata",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      className="max-w-2xl bg-[#0B0C10] border border-[#C5A059]/40 p-0 text-white overflow-hidden shadow-2xl"
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#D4AF37] font-mono text-[9.5px] font-bold uppercase tracking-widest">
                <Flame size={12} /> Stanza Personalizzata & Tribù
              </span>
              <span className="font-mono text-[10px] text-[#A1A1AA]">
                Multiplayer Blind Replay
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
              Forgia le Regole della Prova
            </h2>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex rounded-lg bg-[#14151C] p-1 border border-white/10 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "create"
                  ? "bg-[#C5A059] text-black font-bold shadow"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Crea Stanza
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("join")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "join"
                  ? "bg-[#C5A059] text-black font-bold shadow"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Entra con Codice
            </button>
          </div>
        </div>

        {activeTab === "create" ? (
          <form onSubmit={handleCreate} className="space-y-4 text-left">
            {/* Presets di Tribù in memoria */}
            <TribePresetsManager
              onSelectPreset={handleSelectPreset}
              selectedPresetId={selectedTribePresetId}
            />

            {/* Room Title */}
            <div>
              <label className="text-[10.5px] font-mono text-[#A1A1AA] uppercase tracking-wider block mb-1">
                Titolo della Stanza
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Duello dei Titani XAU/USD..."
                className="w-full px-3 py-2 rounded-lg bg-[#14151C] border border-white/10 text-xs text-white placeholder-white/30 focus:border-[#C5A059] outline-none font-mono"
                required
              />
            </div>

            {/* Asset & Timeframe */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider block mb-1">
                  Asset / Strumento Fisso per Tutti
                </label>
                <select
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#14151C] border border-white/10 text-xs text-white outline-none font-mono"
                >
                  <option value="XAU/USD">XAU/USD (Oro)</option>
                  <option value="EUR/USD">EUR/USD (Forex Major)</option>
                  <option value="GBP/USD">GBP/USD (Forex Major)</option>
                  <option value="US30">US30 (Dow Jones)</option>
                  <option value="NAS100">NAS100 (Nasdaq)</option>
                  <option value="BTC/USD">BTC/USD (Crypto)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider block mb-1">
                  Timeframe Operativo
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#14151C] border border-white/10 text-xs text-white outline-none font-mono"
                >
                  <option value="M1">M1 (Scalping Dinamico)</option>
                  <option value="M5">M5 (Intraday Disciplinato)</option>
                  <option value="M15">M15 (Breakout di Sessione)</option>
                  <option value="H1">H1 (Swing Trading)</option>
                </select>
              </div>
            </div>

            {/* Risk Rules & Target */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#121318] border border-white/5 font-mono text-[10.5px]">
              <div>
                <label className="text-[#A1A1AA] block mb-1">Max DD Consentito</label>
                <select
                  value={maxDrawdownPct}
                  onChange={(e) => setMaxDrawdownPct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#1B1C23] border border-white/10 text-white text-xs outline-none"
                >
                  <option value="3.00">3.0% (Chirurgico)</option>
                  <option value="5.00">5.0% (Rigido)</option>
                  <option value="8.00">8.0% (Standard)</option>
                  <option value="10.00">10.0% (Limen Standard)</option>
                  <option value="15.00">15.0% (Aperto)</option>
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Target Profit</label>
                <select
                  value={targetProfitPct}
                  onChange={(e) => setTargetProfitPct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#1B1C23] border border-white/10 text-white text-xs outline-none"
                >
                  <option value="0.00">Nessun Target (Miglior PnL)</option>
                  <option value="5.00">+5.0% (Scalping)</option>
                  <option value="8.00">+8.0%</option>
                  <option value="10.00">+10.0%</option>
                  <option value="15.00">+15.0% (Obiettivo)</option>
                  <option value="20.00">+20.0%</option>
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Max Ordini</label>
                <select
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded bg-[#1B1C23] border border-white/10 text-white text-xs outline-none"
                >
                  <option value={20}>20 trade</option>
                  <option value={30}>30 trade</option>
                  <option value={50}>50 trade</option>
                  <option value={100}>100 trade</option>
                </select>
              </div>
            </div>

            {/* Modalità Temporale Opzionale (Senza Timer vs A Tempo) */}
            <div className="p-3 rounded-lg bg-[#121318] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase font-bold text-[#E8C56A] flex items-center gap-1.5">
                  <Clock size={12} /> Modalità Temporale della Prova
                </span>
                <span className="font-mono text-[9.5px] text-[#A1A1AA]">
                  {hasTimeLimit ? `${timeLimitMinutes} minuti` : "Senza Timer"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setHasTimeLimit(false)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    !hasTimeLimit
                      ? "border-[#E8C56A] bg-[#C5A059]/15 text-white shadow-sm"
                      : "border-white/10 bg-[#161822] text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 text-[#E8C56A]">
                    <Shield size={12} /> Senza Limite di Tempo
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5 leading-snug">
                    Vince chi raggiunge il Target Profit o resiste al Max DD. Zero fretta.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHasTimeLimit(true)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    hasTimeLimit
                      ? "border-[#E8C56A] bg-[#C5A059]/15 text-white shadow-sm"
                      : "border-white/10 bg-[#161822] text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 text-[#E8C56A]">
                    <Clock size={12} /> Sfida a Tempo (Countdown)
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5 leading-snug">
                    Vince il miglior PnL allo scadere o chi tocca prima il target.
                  </div>
                </button>
              </div>

              {hasTimeLimit && (
                <div className="pt-2 flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                  <span className="text-[#A1A1AA] mr-1">Durata:</span>
                  {[5, 10, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTimeLimitMinutes(m)}
                      className={`px-2 py-1 rounded border transition-all ${
                        timeLimitMinutes === m
                          ? "border-[#E8C56A] bg-[#C5A059]/25 text-[#fef08a] font-bold"
                          : "border-white/10 bg-[#1B1C23] text-slate-300 hover:border-white/30"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Blind Mode Toggle (Date Casuali Diverse) */}
            <div className="p-3 rounded-lg border border-[#C5A059]/40 bg-[#14151C] flex items-start gap-3">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="randomDatesCheck"
                  checked={randomDates}
                  onChange={(e) => setRandomDates(e.target.checked)}
                  className="w-4 h-4 accent-[#D4AF37] cursor-pointer rounded"
                />
              </div>
              <label htmlFor="randomDatesCheck" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                    <Shuffle size={13} /> Date Casuali Diverse per Ciascun Trader (Blind Mode)
                  </span>
                  <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    Consigliato
                  </span>
                </div>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  Tutti i partecipanti affrontano lo <strong>stesso strumento</strong> ({pair}), ma il sistema proietta ciascun trader in una <strong>data storica casuale diversa</strong>. In questo modo è impossibile copiare o prevedere il mercato, premiando la pura padronanza della strategia.
                </p>
              </label>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#1E1F26] border border-white/10 text-xs font-semibold text-[#CBD5E1] hover:bg-[#2A2B35] transition-all"
              >
                Annulla
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 shadow-lg transition-all"
              >
                <span>{isSubmitting ? "Creazione in corso…" : "Crea Stanza & Apri Forgia"}</span>
                <ArrowRight size={14} className="stroke-[2.5]" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoinByCode} className="space-y-4 text-left py-4">
            <div className="p-4 rounded-lg bg-[#121318] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37] uppercase tracking-wider">
                <KeyRound size={14} /> Inserisci il Codice Forgia Condiviso
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Se un tuo compagno di tribù o comandante ha già avviato una lobby, inserisci il codice per collegarti alla stessa stanza multiplayer.
              </p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="es. FORGIA-7429"
                className="w-full px-4 py-3 rounded-lg bg-[#1B1C23] border border-[#C5A059]/40 text-center text-lg font-mono tracking-widest text-[#D4AF37] placeholder-white/20 outline-none uppercase font-bold"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#1E1F26] border border-white/10 text-xs font-semibold text-[#CBD5E1] hover:bg-[#2A2B35] transition-all"
              >
                Annulla
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !joinCode.trim()}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 shadow-lg transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? "Ricerca in corso…" : "Entra nella Stanza"}</span>
                <ArrowRight size={14} className="stroke-[2.5]" />
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
