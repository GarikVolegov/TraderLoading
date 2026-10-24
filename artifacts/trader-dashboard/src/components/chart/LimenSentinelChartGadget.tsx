import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye,
  CheckCircle2,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Target,
  Zap,
  GripHorizontal,
} from "lucide-react";
import type { ExtendedVarcoSetupPlan } from "./LimenAiSetupOverlay";

interface LimenSentinelChartGadgetProps {
  isScanning?: boolean;
  setup: ExtendedVarcoSetupPlan | null;
  symbol: string;
  containerWidth: number;
  containerHeight: number;
  onAdoptSetup?: () => void;
  onScan?: () => void;
  onClose?: () => void;
}

const STORAGE_KEY = "limen_sentinel_gadget_pos_v2";

export function LimenSentinelChartGadget({
  isScanning = false,
  setup,
  containerWidth,
  containerHeight,
  onAdoptSetup,
  onScan,
  onClose,
}: LimenSentinelChartGadgetProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          return { x: parsed.x, y: parsed.y };
        }
      }
    } catch {
      // Fallback
    }
    const defaultX = Math.max(12, (containerWidth || 800) - 295);
    return { x: defaultX, y: 14 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: position.x,
    posY: position.y,
  });

  // Salva la posizione quando cambia
  const savePosition = useCallback((x: number, y: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      // ignore
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const gadgetWidth = isMinimized ? 190 : 270;
    const gadgetHeight = isMinimized ? 38 : 220;

    const maxX = Math.max(10, (containerWidth || 800) - gadgetWidth - 10);
    const maxY = Math.max(10, (containerHeight || 600) - gadgetHeight - 10);

    const newX = Math.max(10, Math.min(maxX, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(maxY, dragStartRef.current.posY + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
    savePosition(position.x, position.y);
  };

  // Se le dimensioni del contenitore cambiano, verifica che il gadget rimanga visibile
  useEffect(() => {
    if (containerWidth > 0 && containerHeight > 0) {
      const gadgetWidth = isMinimized ? 190 : 270;
      const gadgetHeight = isMinimized ? 38 : 220;
      const maxX = Math.max(10, containerWidth - gadgetWidth - 10);
      const maxY = Math.max(10, containerHeight - gadgetHeight - 10);
      setPosition((prev) => {
        const clampedX = Math.max(10, Math.min(maxX, prev.x));
        const clampedY = Math.max(10, Math.min(maxY, prev.y));
        return clampedX !== prev.x || clampedY !== prev.y ? { x: clampedX, y: clampedY } : prev;
      });
    }
  }, [containerWidth, containerHeight, isMinimized]);

  const isLong = setup?.direction === "long";
  const schematicType = setup?.schematicBox?.schematicType || (isLong ? "accumulation" : "distribution");
  const isReaccum = schematicType === "reaccumulation";
  const isRedistrib = schematicType === "redistribution";
  const phase = setup?.schematicBox?.phase || "Phase C";

  const schematicTitle = isReaccum
    ? "RIACCUMULO (CAUSA 2)"
    : isRedistrib
    ? "RIDISTRIBUZIONE (CAUSA 2)"
    : schematicType === "accumulation"
    ? "ACCUMULAZIONE WYCKOFF"
    : "DISTRIBUZIONE WYCKOFF";

  // ── STATO MINIMIZZATO: Mini Pillola Fluttuante con Occhio ──
  if (isMinimized) {
    return (
      <div
        className="limen-sentinel-gadget is-minimized select-none"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="region"
        aria-label="Sentinella Visiva Minimizzata"
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a0a0e]/95 border border-[#C5A059]/40 rounded-full shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing">
          {/* Occhio Animato */}
          <div className="relative flex items-center justify-center">
            {isScanning ? (
              <>
                <span className="limen-eye-radar-sweep" />
                <Loader2 size={12} className="animate-spin text-[#C5A059]" />
              </>
            ) : (
              <Eye size={12} className={setup ? "text-[#C5A059]" : "text-zinc-400"} />
            )}
            <span
              className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 ${
                isScanning ? "bg-amber-400 animate-ping" : setup ? "bg-emerald-400" : "bg-zinc-500"
              }`}
            />
          </div>

          <span className="font-mono text-[9px] font-bold text-foreground uppercase tracking-tight whitespace-nowrap">
            {isScanning
              ? "Occhio in Scansione..."
              : setup
              ? `${setup.direction.toUpperCase()} · ${setup.triggerType || "TEST"}`
              : "Sentinella"}
          </span>

          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-0.5 text-zinc-400 hover:text-white cursor-pointer"
              title="Espandi telemetria"
            >
              <Maximize2 size={11} />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-0.5 text-zinc-400 hover:text-white cursor-pointer"
                title="Nascondi sentinella"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STATO COMPLETO: Riquadro Spostabile con Telemetria ──
  return (
    <div
      className="limen-sentinel-gadget select-none"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      role="region"
      aria-label="Sentinella Visiva Telemetria"
    >
      <div className="w-[270px] bg-[#0c0d12]/95 border border-[#C5A059]/45 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-foreground">
        {/* ── Testata del Gadget: Maniglia di Drag + Occhio che Analizza ── */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-black/80 via-[#161720]/80 to-black/80 border-b border-white/10 cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {/* L'Occhio che sta analizzando */}
            <div className="relative w-5 h-5 rounded-md bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
              {isScanning ? (
                <>
                  <span className="limen-eye-radar-sweep" />
                  <Loader2 size={11} className="animate-spin text-[#C5A059]" />
                </>
              ) : (
                <Eye size={11} className={setup ? "text-[#C5A059]" : "text-zinc-400"} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <strong className="text-[10px] uppercase font-mono tracking-wider text-[#C5A059] font-bold whitespace-nowrap">
                  Sentinella Visiva
                </strong>
                <GripHorizontal size={10} className="text-zinc-500 opacity-60" />
              </div>
            </div>
          </div>

          {/* Controlli Gadget (Minimizza / Chiudi) */}
          <div className="flex items-center gap-1">
            {onScan && (
              <button
                type="button"
                disabled={isScanning}
                onClick={onScan}
                className="p-1 rounded text-zinc-400 hover:text-[#C5A059] hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                title="Riscansiona grafico ora"
              >
                <Sparkles size={11} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Riduci a mini pillola fluttuante"
            >
              <Minimize2 size={11} />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                title="Chiudi widget sentinella"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* ── Corpo Telemetrico della Schematica Wyckoff ── */}
        <div className="p-2.5 space-y-2 text-[11px] font-mono">
          {/* Badge Schematica e Fase */}
          <div className="flex items-center justify-between gap-1">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-tight whitespace-nowrap ${
                isReaccum || isRedistrib
                  ? "bg-purple-500/15 text-purple-300 border-purple-500/35"
                  : isLong
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/35"
              }`}
            >
              {schematicTitle}
            </span>

            <span className="text-[9px] text-[#C5A059] font-bold bg-[#C5A059]/10 px-1.5 py-0.5 rounded border border-[#C5A059]/20 whitespace-nowrap">
              {phase}
            </span>
          </div>

          {/* Dati Prezzo e Trigger Setup */}
          {setup ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="p-1.5 rounded bg-black/40 border border-white/5">
                  <span className="text-[8px] text-zinc-400 uppercase block">Direzione / Tipo</span>
                  <div className="flex items-center gap-1 font-bold">
                    {isLong ? (
                      <ArrowUpRight size={11} className="text-emerald-400" />
                    ) : (
                      <ArrowDownRight size={11} className="text-rose-400" />
                    )}
                    <span className={isLong ? "text-emerald-300" : "text-rose-300"}>
                      {setup.direction.toUpperCase()} {setup.orderType === "limit" ? "LIMIT" : ""}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 rounded bg-black/40 border border-white/5">
                  <span className="text-[8px] text-zinc-400 uppercase block">Trigger Attivo</span>
                  <span className="text-[#C5A059] font-bold block truncate">
                    {setup.triggerType || "TEST"}
                  </span>
                </div>
              </div>

              {/* Box Livelli Finanziari */}
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="p-1 rounded bg-black/50 border border-white/5">
                  <span className="text-[7.5px] text-zinc-400 uppercase block">Entry</span>
                  <span className="font-bold text-white whitespace-nowrap">{setup.entryPrice}</span>
                </div>
                <div className="p-1 rounded bg-black/50 border border-white/5">
                  <span className="text-[7.5px] text-rose-400/90 uppercase block">SL (-{setup.pipsRisk}p)</span>
                  <span className="font-bold text-rose-300 whitespace-nowrap">{setup.stopLossPrice}</span>
                </div>
                <div className="p-1 rounded bg-black/50 border border-white/5">
                  <span className="text-[7.5px] text-emerald-400/90 uppercase block">TP1 (1:3R)</span>
                  <span className="font-bold text-emerald-300 whitespace-nowrap">{setup.takeProfit1Price}</span>
                </div>
              </div>

              {/* R:R e Invalidation Info */}
              <div className="flex items-center justify-between text-[9px] text-zinc-400 px-1">
                <span>R:R Calcolato: <strong className="text-emerald-400">1:{setup.riskRewardRatio}</strong></span>
                <span>Size: <strong className="text-[#C5A059]">{setup.lotSize}L</strong></span>
              </div>
            </>
          ) : (
            <div className="py-3 text-center text-zinc-400 text-[10px] space-y-1">
              <p>{isScanning ? "Scansione candele in corso..." : "In attesa di caccia o rottura strutturale"}</p>
              <span className="text-[9px] text-zinc-500 block">L'occhio analizza il ciclo e le zone Apollo</span>
            </div>
          )}

          {/* ── Tasto Primario di Adozione nel Varco ── */}
          {setup && onAdoptSetup && (
            <div className="pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={onAdoptSetup}
                className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#d8b167] hover:brightness-110 text-black font-bold text-[10.5px] flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-[0.99]"
                title="Adotta i prezzi di Entry, Stop Loss e Take Profit nella finestra operativa del Varco"
              >
                <CheckCircle2 size={12} className="shrink-0" />
                <span className="whitespace-nowrap">Adotta nel Varco</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
