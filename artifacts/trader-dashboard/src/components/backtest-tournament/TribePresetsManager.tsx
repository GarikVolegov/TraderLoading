import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTribePresets,
  saveTribePreset,
  deleteTribePreset,
  backtestTribesKey,
  type BacktestTribePreset,
} from "@/lib/backtestTournamentsApi";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Flame,
  Scale,
  Users,
  Plus,
  Trash2,
  Check,
  Shuffle,
  Sparkles,
} from "lucide-react";

interface Props {
  onSelectPreset?: (preset: BacktestTribePreset) => void;
  selectedPresetId?: number | null;
}

export function TribePresetsManager({ onSelectPreset, selectedPresetId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTribeName, setNewTribeName] = useState("");
  const [newPair, setNewPair] = useState("XAU/USD");
  const [newTimeframe, setNewTimeframe] = useState("M5");
  const [newMaxDD, setNewMaxDD] = useState("10.00");
  const [newTarget, setNewTarget] = useState("15.00");

  const tribesQuery = useQuery({
    queryKey: backtestTribesKey(),
    queryFn: () => fetchTribePresets(),
  });

  const saveMutation = useMutation({
    mutationFn: (preset: Partial<BacktestTribePreset>) => saveTribePreset(preset),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: backtestTribesKey() });
      toast({
        title: "Tribù Salvata in Memoria",
        description: `La configurazione per "${data.tribe.tribeName}" è pronta per le tue battaglie.`,
      });
      setIsCreating(false);
      setNewTribeName("");
      if (onSelectPreset) {
        onSelectPreset(data.tribe);
      }
    },
    onError: (err) => {
      toast({
        title: "Errore salvataggio",
        description: (err as Error).message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTribePreset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backtestTribesKey() });
      toast({
        title: "Tribù rimossa",
        description: "Il preset è stato eliminato dalla memoria.",
      });
    },
  });

  const tribes = tribesQuery.data?.tribes ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTribeName.trim()) return;

    saveMutation.mutate({
      tribeName: newTribeName.trim(),
      sigil: "fratellanza",
      pair: newPair,
      timeframe: newTimeframe,
      initialBalance: "100000.00",
      maxDrawdownPct: newMaxDD,
      targetProfitPct: newTarget,
      maxTrades: 50,
      timeLimitSeconds: 900,
      randomDates: true,
      defaultMembers: ["Tu"],
    });
  };

  const getSigilIcon = (sigil: string) => {
    switch (sigil) {
      case "fuoco":
        return <Flame size={14} className="text-amber-400" />;
      case "scudo":
        return <Shield size={14} className="text-emerald-400" />;
      case "bilancia":
        return <Scale size={14} className="text-blue-400" />;
      default:
        return <Users size={14} className="text-[#D4AF37]" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
          <Shield size={13} />
          <span>Gruppi & Tribù in Memoria</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E1F26] hover:bg-[#2A2B35] border border-white/10 text-[10.5px] font-mono text-[#CBD5E1] transition-all"
        >
          <Plus size={12} />
          <span>{isCreating ? "Chiudi" : "Nuova Tribù"}</span>
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-3 rounded-lg bg-[#121318] border border-[#C5A059]/40 space-y-3"
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1">
            <Sparkles size={12} className="text-[#D4AF37]" /> Crea Nuovo Preset Tribù
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#A1A1AA] block mb-1">
              Nome della Tribù
            </label>
            <input
              type="text"
              value={newTribeName}
              onChange={(e) => setNewTribeName(e.target.value)}
              placeholder="es. Falange di Sparta, Custodi M15..."
              className="w-full px-2.5 py-1.5 rounded bg-[#1B1C23] border border-white/10 text-xs text-white placeholder-white/30 focus:border-[#C5A059] outline-none font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div>
              <label className="text-[9.5px] text-[#A1A1AA] block mb-0.5">Asset / Pair</label>
              <select
                value={newPair}
                onChange={(e) => setNewPair(e.target.value)}
                className="w-full px-2 py-1 rounded bg-[#1B1C23] border border-white/10 text-white text-xs outline-none"
              >
                <option value="XAU/USD">XAU/USD (Oro)</option>
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="US30">US30 (Wall St)</option>
                <option value="NAS100">NAS100 (Nasdaq)</option>
                <option value="BTC/USD">BTC/USD</option>
              </select>
            </div>
            <div>
              <label className="text-[9.5px] text-[#A1A1AA] block mb-0.5">Timeframe</label>
              <select
                value={newTimeframe}
                onChange={(e) => setNewTimeframe(e.target.value)}
                className="w-full px-2 py-1 rounded bg-[#1B1C23] border border-white/10 text-white text-xs outline-none"
              >
                <option value="M1">M1 (Scalping)</option>
                <option value="M5">M5 (Intraday)</option>
                <option value="M15">M15 (Breakout)</option>
                <option value="H1">H1 (Swing)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 rounded bg-transparent text-[#A1A1AA] hover:text-white text-[11px] font-mono"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-3.5 py-1 rounded bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono font-bold text-[11px] uppercase tracking-wider"
            >
              {saveMutation.isPending ? "Salvataggio…" : "Salva Tribù"}
            </button>
          </div>
        </form>
      )}

      {/* Preset List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tribes.map((tribe) => {
          const isSelected = selectedPresetId === tribe.id;
          return (
            <div
              key={tribe.id}
              onClick={() => onSelectPreset?.(tribe)}
              className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-[#C5A059]/15 border-[#D4AF37] shadow-lg"
                  : "bg-[#14151C] border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#1F202B] border border-white/10 flex items-center justify-center">
                    {getSigilIcon(tribe.sigil)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight">
                      {tribe.tribeName}
                    </span>
                    <span className="text-[9.5px] font-mono text-[#8E92A0]">
                      {tribe.pair} · {tribe.timeframe} · DD {tribe.maxDrawdownPct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black flex items-center justify-center">
                      <Check size={11} className="stroke-[3]" />
                    </span>
                  )}
                  {tribe.userId !== "system_limen" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(tribe.id);
                      }}
                      className="text-white/40 hover:text-red-400 p-0.5 rounded transition-all"
                      title="Elimina preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-[#A1A1AA]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Shuffle size={10} /> Date Casuali Blind
                </span>
                <span>{tribe.defaultMembers?.length || 1} Compagni</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
