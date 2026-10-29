import React, { useState, useMemo } from "react";
import {
  Heart,
  Activity,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Wind,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface TradeBioTelemetryData {
  symbol?: string;
  direction?: string; // "LONG" | "SHORT" | "BUY" | "SELL"
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl?: number | null;
  rMultiple?: number | null;
  duration?: string | null;
  isWin?: boolean;
  isLoss?: boolean;
  tags?: string[];
  openTime?: string | null;
  closeTime?: string | null;
}

export interface BioTensionPoint {
  tPct: number; // 0 to 100
  label: string;
  bpm: number;
  drawdownPct: number; // distance toward SL (0 = entry, 100 = SL)
  rValue: number; // running R multiple
  phase: "entry" | "holding" | "pullback" | "climax" | "exit";
  annotation?: string;
  stressLevel: "calm" | "elevated" | "critical";
}

export interface DisciplineBioTensionChartProps {
  trade: TradeBioTelemetryData;
  className?: string;
  onOpenTacticalBreath?: () => void;
  compact?: boolean;
}

/**
 * Genera la traiettoria fisiologica deterministica del trade, correlando
 * l'escursione di prezzo verso lo Stop Loss con la contrazione cardiaca (BPM).
 */
export function generateTradeBioTension(trade: TradeBioTelemetryData): {
  points: BioTensionPoint[];
  avgBpm: number;
  peakBpm: number;
  timeInRedZonePct: number;
  clarityIndex: number;
  verdict: {
    type: "calm" | "moderate" | "critical";
    badge: string;
    description: string;
  };
} {
  const isLoss = trade.isLoss || (trade.pnl != null && trade.pnl < 0);
  const isWin = trade.isWin || (trade.pnl != null && trade.pnl > 0);
  const tags = trade.tags?.map((t) => t.toLowerCase()) ?? [];
  const hasCalmTag = tags.includes("calma") || tags.includes("respiro") || tags.includes("cardio-zen");
  const hasFomoTag = tags.includes("fomo") || tags.includes("anticipazione") || tags.includes("cardio-deriva");
  const hasPrematureTag = tags.includes("uscita_prematura") || tags.includes("esitazione");
  const hasStop = Boolean(trade.stopLoss);
  const finalR = trade.rMultiple ?? (isWin ? 1.5 : isLoss ? -1.0 : 0);

  // Se presente tag specifico con battito registrato da Smartwatch (es. bpm-78)
  const bpmTag = tags.find((t) => /^bpm-(\d+)$/.test(t));
  const registeredBpm = bpmTag ? parseInt(bpmTag.replace("bpm-", ""), 10) : undefined;

  // Initial Entry BPM: battito smartwatch reale o stima da tag
  const baseEntryBpm = registeredBpm ?? (hasCalmTag ? 60 : hasFomoTag ? 84 : 66);

  const points: BioTensionPoint[] = [];

  // Punto 0: Entry
  points.push({
    tPct: 0,
    label: "Ingresso (0%)",
    bpm: baseEntryBpm,
    drawdownPct: 0,
    rValue: 0,
    phase: "entry",
    annotation: hasFomoTag ? "Ingresso Fisiologicamente Teso" : "Ingresso Stoico Centrato",
    stressLevel: baseEntryBpm >= 90 ? "critical" : baseEntryBpm >= 76 ? "elevated" : "calm",
  });

  if (isWin) {
    // Trade vincente: possibile pullback iniziale seguito da espansione fluida
    const pullbackBpm = hasCalmTag ? 68 : 78;
    points.push({
      tPct: 20,
      label: "Oscillazione (20%)",
      bpm: pullbackBpm,
      drawdownPct: 25,
      rValue: -0.25,
      phase: "pullback",
      annotation: "Test del Supporto",
      stressLevel: pullbackBpm >= 90 ? "critical" : pullbackBpm >= 76 ? "elevated" : "calm",
    });

    points.push({
      tPct: 45,
      label: "Break-even (45%)",
      bpm: 64,
      drawdownPct: 0,
      rValue: 0.3,
      phase: "holding",
      stressLevel: "calm",
    });

    points.push({
      tPct: 75,
      label: "Espansione (75%)",
      bpm: 59,
      drawdownPct: 0,
      rValue: finalR * 0.75,
      phase: "holding",
      annotation: "Target Imminente",
      stressLevel: "calm",
    });

    points.push({
      tPct: 100,
      label: "Take Profit (100%)",
      bpm: 58,
      drawdownPct: 0,
      rValue: finalR,
      phase: "exit",
      annotation: "Esecuzione Disciplinata",
      stressLevel: "calm",
    });
  } else if (isLoss) {
    // Trade in perdita: tensione crescente fino al tocco dello Stop o contrazione emotiva
    points.push({
      tPct: 25,
      label: "Fase Iniziale (25%)",
      bpm: baseEntryBpm + 6,
      drawdownPct: 30,
      rValue: -0.3,
      phase: "holding",
      stressLevel: "calm",
    });

    const pullbackBpm = hasStop ? 86 : 94;
    points.push({
      tPct: 55,
      label: "Pullback (55%)",
      bpm: pullbackBpm,
      drawdownPct: 65,
      rValue: -0.65,
      phase: "pullback",
      annotation: hasStop ? "Pressione sul Livello di Stop" : "Esposizione non Protetta",
      stressLevel: pullbackBpm >= 90 ? "critical" : "elevated",
    });

    // Punto di Massimo Stress (Climax)
    const peakStressBpm = hasStop ? (hasCalmTag ? 92 : 102) : 108;
    points.push({
      tPct: 80,
      label: "Soglia Critica (80%)",
      bpm: peakStressBpm,
      drawdownPct: 90,
      rValue: -0.9,
      phase: "climax",
      annotation: hasStop ? "Prossimità allo Stop Loss" : "Allerta Tilt Sovrana",
      stressLevel: "critical",
    });

    const exitBpm = hasPrematureTag ? 96 : (hasStop ? 104 : 110);
    points.push({
      tPct: 100,
      label: "Chiusura (100%)",
      bpm: exitBpm,
      drawdownPct: 100,
      rValue: finalR,
      phase: "exit",
      annotation: hasPrematureTag ? "Uscita da Paura / Anticipata" : "Stop Assorbito da Piano",
      stressLevel: "critical",
    });
  } else {
    // Breakeven / Pareggio
    points.push({
      tPct: 35,
      label: "Oscillazione (35%)",
      bpm: 72,
      drawdownPct: 35,
      rValue: -0.2,
      phase: "holding",
      stressLevel: "calm",
    });
    points.push({
      tPct: 70,
      label: "Ritorno (70%)",
      bpm: 65,
      drawdownPct: 10,
      rValue: 0.1,
      phase: "holding",
      stressLevel: "calm",
    });
    points.push({
      tPct: 100,
      label: "Chiusura Parità (100%)",
      bpm: 62,
      drawdownPct: 0,
      rValue: 0,
      phase: "exit",
      annotation: "Pareggio Strategico",
      stressLevel: "calm",
    });
  }

  const bpms = points.map((p) => p.bpm);
  const peakBpm = Math.max(...bpms);
  const avgBpm = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);

  const redPoints = points.filter((p) => p.bpm >= 90).length;
  const timeInRedZonePct = Math.round((redPoints / points.length) * 100);

  // Indice di Lucidità Clinica (CLI): 0 - 100%
  let clarityIndex = 98;
  if (peakBpm > 75) clarityIndex -= (peakBpm - 75) * 1.3;
  if (!hasStop) clarityIndex -= 25;
  if (hasPrematureTag) clarityIndex -= 15;
  if (hasCalmTag) clarityIndex += 10;
  clarityIndex = Math.max(20, Math.min(98, Math.round(clarityIndex)));

  let verdict: { type: "calm" | "moderate" | "critical"; badge: string; description: string };
  if (clarityIndex >= 82) {
    verdict = {
      type: "calm",
      badge: "LUCIDITÀ STOICA",
      description: "Esecuzione a mente fredda. Nessun cedimento emotivo o contrazione fisiologica rilevata.",
    };
  } else if (clarityIndex >= 60) {
    verdict = {
      type: "moderate",
      badge: "TENSIONE VIGILE",
      description: "Accelerazione del battito nei pullback gestita senza infrangere il piano operativo.",
    };
  } else {
    verdict = {
      type: "critical",
      badge: "CONTRAZIONE EMOZIONALE",
      description: "Picco di stress acuto durante il drawdown: consigliata pratica di Respiro 4-7-8 prima del prossimo trade.",
    };
  }

  return {
    points,
    avgBpm,
    peakBpm,
    timeInRedZonePct,
    clarityIndex,
    verdict,
  };
}

export function DisciplineBioTensionChart({
  trade,
  className,
  onOpenTacticalBreath,
  compact = false,
}: DisciplineBioTensionChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<BioTensionPoint | null>(null);

  const { points, avgBpm, peakBpm, timeInRedZonePct, clarityIndex, verdict } = useMemo(
    () => generateTradeBioTension(trade),
    [trade],
  );

  // Coordinate di disegno SVG (600 x 200)
  const W = 600;
  const H = compact ? 150 : 200;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 30;

  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // BPM scale: 50 -> padT + chartH, 120 -> padT
  const minBpm = 50;
  const maxBpm = 120;
  const getYForBpm = (bpm: number) => {
    const clamped = Math.max(minBpm, Math.min(maxBpm, bpm));
    const ratio = (clamped - minBpm) / (maxBpm - minBpm);
    return padT + chartH * (1 - ratio);
  };

  const getXForT = (tPct: number) => {
    return padL + (tPct / 100) * chartW;
  };

  // Costruzione curva Bezier cubica per i BPM
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${getXForT(points[0].tPct).toFixed(1)} ${getYForBpm(points[0].bpm).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prevX = getXForT(points[i - 1].tPct);
      const prevY = getYForBpm(points[i - 1].bpm);
      const curX = getXForT(points[i].tPct);
      const curY = getYForBpm(points[i].bpm);
      const c1X = prevX + (curX - prevX) * 0.5;
      const c1Y = prevY;
      const c2X = prevX + (curX - prevX) * 0.5;
      const c2Y = curY;
      d += ` C ${c1X.toFixed(1)} ${c1Y.toFixed(1)}, ${c2X.toFixed(1)} ${c2Y.toFixed(1)}, ${curX.toFixed(1)} ${curY.toFixed(1)}`;
    }
    return d;
  }, [points]);

  // Area sottesa alla curva per il gradiente volumetrico
  const areaD = useMemo(() => {
    if (points.length === 0) return "";
    const firstX = getXForT(points[0].tPct).toFixed(1);
    const lastX = getXForT(points[points.length - 1].tPct).toFixed(1);
    const bottomY = (padT + chartH).toFixed(1);
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points]);

  // Posizione soglie chiave (70 BPM Calma, 90 BPM Tilt)
  const y70 = getYForBpm(70);
  const y90 = getYForBpm(90);

  // Trova il punto di massimo stress
  const peakPoint = useMemo(() => {
    return points.reduce((max, p) => (p.bpm > max.bpm ? p : max), points[0]);
  }, [points]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-[#C5A059]/30 bg-[#07080b]/95 p-3 font-mono shadow-2xl relative overflow-hidden select-none",
        className,
      )}
    >
      {/* Sfondo Radiale Sottile AUREUS */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(197,160,89,0.06)_0%,_transparent_70%)] pointer-events-none" />

      {/* Intestazione Telemetrica Termobarica */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#ef4444]/15 border border-[#ef4444]/35 flex items-center justify-center text-[#ef4444]">
            <Heart size={13} className="animate-pulse" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">
                Replay Termobarico · Curva della Tensione
              </h4>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider border whitespace-nowrap",
                  verdict.type === "calm"
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                    : verdict.type === "moderate"
                    ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                    : "bg-rose-500/15 border-rose-500/35 text-rose-300 animate-pulse",
                )}
              >
                {verdict.badge}
              </span>
            </div>
            <p className="text-[9.5px] text-[#8E92A0] m-0">
              Correlazione dinamica tra frequenza cardiaca (BPM) e traiettoria del trade
            </p>
          </div>
        </div>

        {/* Pulsante Respiro Tattico se stress elevato */}
        {verdict.type === "critical" && onOpenTacticalBreath && (
          <button
            type="button"
            onClick={onOpenTacticalBreath}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 hover:bg-[#C5A059]/25 text-[#E8C56A] text-[9.5px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shadow-[0_0_10px_rgba(197,160,89,0.2)]"
            title="Avvia il protocollo di Respiro Tattico 4-7-8 per azzerare il cortisolo"
          >
            <Wind size={11} />
            <span>Reset Respiro 4-7-8</span>
          </button>
        )}
      </div>

      {/* Grafico SVG Vettoriale */}
      <div className="relative w-full overflow-hidden shrink-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: compact ? "160px" : "210px" }}
        >
          <defs>
            {/* Gradiente volumetrico area sotto curva */}
            <linearGradient id="bioTensionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>

            {/* Gradiente per il tratto della curva BPM */}
            <linearGradient id="bioStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor={peakBpm >= 90 ? "#ef4444" : "#f59e0b"} />
              <stop offset="100%" stopColor={trade.isWin ? "#10b981" : "#ef4444"} />
            </linearGradient>

            {/* Glow filtrato per punto di picco */}
            <filter id="peakGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Sfondo Fasce di Tensione Fisiologica */}
          {/* Zona Rossa: 90 - 120 BPM */}
          <rect
            x={padL}
            y={padT}
            width={chartW}
            height={y90 - padT}
            fill="rgba(239, 68, 68, 0.06)"
          />
          {/* Zona Ambra: 75 - 90 BPM */}
          <rect
            x={padL}
            y={y90}
            width={chartW}
            height={y70 - y90}
            fill="rgba(245, 158, 11, 0.03)"
          />
          {/* Zona Verde: 50 - 70 BPM */}
          <rect
            x={padL}
            y={y70}
            width={chartW}
            height={padT + chartH - y70}
            fill="rgba(16, 185, 129, 0.04)"
          />

          {/* Linee Guida Orizzontali (Grid) */}
          {/* Soglia Critica Tilt 90 BPM */}
          <line
            x1={padL}
            y1={y90}
            x2={padL + chartW}
            y2={y90}
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.5"
          />
          <text
            x={padL + 6}
            y={y90 - 4}
            fill="#ef4444"
            fontSize="8.5"
            fontWeight="bold"
            letterSpacing="0.08em"
            className="select-none"
          >
            SOGLIA DI TENSIONE (90 BPM)
          </text>

          {/* Linea Calma Stoica 70 BPM */}
          <line
            x1={padL}
            y1={y70}
            x2={padL + chartW}
            y2={y70}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
          />
          <text
            x={padL + 6}
            y={y70 - 4}
            fill="#10b981"
            fontSize="8.5"
            fontWeight="bold"
            letterSpacing="0.08em"
            className="select-none"
          >
            CALMA STOICA (70 BPM)
          </text>

          {/* Asse Y (Etichette BPM) */}
          <text x={padL - 6} y={getYForBpm(110) + 3} textAnchor="end" fill="#64748b" fontSize="8.5">
            110
          </text>
          <text x={padL - 6} y={y90 + 3} textAnchor="end" fill="#ef4444" fontSize="8.5" fontWeight="bold">
            90
          </text>
          <text x={padL - 6} y={y70 + 3} textAnchor="end" fill="#10b981" fontSize="8.5" fontWeight="bold">
            70
          </text>
          <text x={padL - 6} y={getYForBpm(55) + 3} textAnchor="end" fill="#64748b" fontSize="8.5">
            55
          </text>

          {/* Tratteggio Area Volumetrica */}
          <path d={areaD} fill="url(#bioTensionFill)" />

          {/* Curva BPM */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#bioStroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Punti Interattivi della Traiettoria */}
          {points.map((pt, idx) => {
            const cx = getXForT(pt.tPct);
            const cy = getYForBpm(pt.bpm);
            const isPeak = pt === peakPoint && pt.bpm >= 85;
            const isHovered = hoveredPoint === pt;

            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Alone pulsante se punto di picco */}
                {isPeak && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="9"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Cerchio punto */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : isPeak ? 4.5 : 3.5}
                  fill={
                    pt.stressLevel === "critical"
                      ? "#ef4444"
                      : pt.stressLevel === "elevated"
                      ? "#f59e0b"
                      : "#10b981"
                  }
                  stroke="#07080b"
                  strokeWidth="2"
                  filter={isPeak ? "url(#peakGlow)" : undefined}
                />

                {/* Marker fisso di picco massimo se sopra gli 85 BPM */}
                {isPeak && (
                  <g transform={`translate(${cx}, ${cy - 14})`}>
                    <rect
                      x="-42"
                      y="-12"
                      width="84"
                      height="15"
                      rx="3"
                      fill="#0d0f14"
                      stroke="#ef4444"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-2"
                      textAnchor="middle"
                      fill="#ef4444"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      MAX: {pt.bpm} BPM
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Asse X Temporale (Entry, Metà, Uscita) */}
          <line
            x1={padL}
            y1={padT + chartH}
            x2={padL + chartW}
            y2={padT + chartH}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
          />
          <text x={padL} y={padT + chartH + 14} fill="#94a3b8" fontSize="8.5">
            Ingresso
          </text>
          <text x={padL + chartW * 0.5} y={padT + chartH + 14} textAnchor="middle" fill="#64748b" fontSize="8.5">
            Evoluzione
          </text>
          <text x={padL + chartW} y={padT + chartH + 14} textAnchor="end" fill="#94a3b8" fontSize="8.5">
            Chiusura
          </text>

          {/* Tooltip Galleggiante su Hover */}
          {hoveredPoint && (
            <g transform={`translate(${getXForT(hoveredPoint.tPct)}, ${getYForBpm(hoveredPoint.bpm)})`}>
              <line
                x1="0"
                y1={-chartH}
                x2="0"
                y2={chartH}
                stroke="#C5A059"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <g transform="translate(0, -28)">
                <rect
                  x="-55"
                  y="-16"
                  width="110"
                  height="26"
                  rx="4"
                  fill="#0d0f14"
                  stroke="#C5A059"
                  strokeWidth="1"
                  filter="drop-shadow(0 4px 12px rgba(0,0,0,0.8))"
                />
                <text x="0" y="-3" textAnchor="middle" fill="#E8C56A" fontSize="9" fontWeight="bold">
                  {hoveredPoint.bpm} BPM · {hoveredPoint.label}
                </text>
                <text x="0" y="7" textAnchor="middle" fill="#94a3b8" fontSize="7.5">
                  {hoveredPoint.annotation || `R: ${hoveredPoint.rValue > 0 ? "+" : ""}${hoveredPoint.rValue.toFixed(1)}R`}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 4 Telemetrie Cliniche Sintetiche */}
      <div className="grid grid-cols-4 gap-1.5 pt-2 mt-2 border-t border-white/10 shrink-0 text-center">
        <div className="bg-[#121318] border border-white/5 rounded p-1.5">
          <span className="text-[8px] uppercase tracking-wider text-[#8E92A0] block">BPM Medio</span>
          <strong className="text-white text-xs whitespace-nowrap">{avgBpm} BPM</strong>
        </div>

        <div className="bg-[#121318] border border-white/5 rounded p-1.5">
          <span className="text-[8px] uppercase tracking-wider text-[#8E92A0] block">Picco Tensione</span>
          <strong
            className={cn(
              "text-xs whitespace-nowrap",
              peakBpm >= 90 ? "text-rose-400" : peakBpm >= 76 ? "text-amber-300" : "text-emerald-400",
            )}
          >
            {peakBpm} BPM
          </strong>
        </div>

        <div className="bg-[#121318] border border-white/5 rounded p-1.5">
          <span className="text-[8px] uppercase tracking-wider text-[#8E92A0] block">Zona Rossa</span>
          <strong
            className={cn(
              "text-xs whitespace-nowrap",
              timeInRedZonePct > 0 ? "text-rose-400" : "text-emerald-400",
            )}
          >
            {timeInRedZonePct}%
          </strong>
        </div>

        <div className="bg-[#121318] border border-white/5 rounded p-1.5">
          <span className="text-[8px] uppercase tracking-wider text-[#8E92A0] block">Lucidità (CLI)</span>
          <strong
            className={cn(
              "text-xs whitespace-nowrap",
              clarityIndex >= 80 ? "text-emerald-400" : clarityIndex >= 60 ? "text-[#E8C56A]" : "text-rose-400",
            )}
          >
            {clarityIndex}%
          </strong>
        </div>
      </div>

      {/* Verdetto Sintetico Finale (Zero muri di testo: 1 riga chirurgica) */}
      <div className="mt-2 p-2 rounded-lg bg-[#121318]/70 border border-white/5 flex items-center gap-2 text-[10px] shrink-0">
        <Info size={12} className="text-[#C5A059] shrink-0" />
        <span className="text-[#CBD5E1] truncate">
          <strong className="text-white">{verdict.badge}:</strong> {verdict.description}
        </span>
      </div>
    </div>
  );
}
