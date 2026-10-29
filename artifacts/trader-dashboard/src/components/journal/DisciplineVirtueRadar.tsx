import React, { useMemo, useState } from "react";
import type { JournalEntry } from "@workspace/api-client-react";
import { parseTradeContent } from "@/lib/parseTradeContent";
import { VIRTU_TAGS, LEAK_TAGS } from "./SessionDetailInspector";
import { ShieldCheck, AlertTriangle, Compass, TrendingUp, TrendingDown, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagMetric {
  id: string;
  label: string;
  icon: string;
  isPositive: boolean;
  count: number;
  frequencyPct: number;
  totalPnl: number;
  winRate: number;
  avgR: number;
  normalizedScore: number; // 0 - 100
}

export interface DisciplineAnalysis {
  virtueMetrics: TagMetric[];
  leakMetrics: TagMetric[];
  allMetrics: TagMetric[];
  totalTradesAnalyzed: number;
  taggedTradesCount: number;
  integrityScore: number; // 0 - 100
  virtueYield: number; // net profit from trades with virtue tags
  leakBleed: number; // total losses from trades with leak tags
  dominantVirtue: TagMetric | null;
  criticalLeak: TagMetric | null;
}

export function extractProfitFromEntry(entry: JournalEntry): number {
  const parsed = parseTradeContent(entry.content ?? "");
  if (parsed && typeof parsed.profit === "number") {
    return parsed.profit;
  }
  const content = entry.content ?? "";
  const match = content.match(/(?:profit|pnl|p&l)\s*:\s*([+-]?\d+(?:\.\d+)?)/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) return val;
  }
  if (entry.result === "win") return 100;
  if (entry.result === "loss") return -100;
  return 0;
}

/**
 * Pure calculation engine for cognitive & behavioral discipline.
 */
export function computeDisciplineAnalysis(entries: JournalEntry[]): DisciplineAnalysis {
  const totalTrades = entries.length;

  const tagCounts: Record<string, { count: number; pnl: number; wins: number; totalR: number }> = {};
  for (const t of [...VIRTU_TAGS, ...LEAK_TAGS]) {
    tagCounts[t.id] = { count: 0, pnl: 0, wins: 0, totalR: 0 };
  }

  let taggedTradesCount = 0;
  let virtueYield = 0;
  let leakBleed = 0;
  let totalVirtueCount = 0;
  let totalLeakCount = 0;

  for (const entry of entries) {
    const rawTags = (entry.tags ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const contentLower = (entry.content ?? "").toLowerCase();
    const hasCalm =
      rawTags.some((t) => t === "calma" || t === "respiro-478" || t === "respiro") ||
      contentLower.includes("respiro tattico");

    const normalizedTags = new Set(rawTags);
    if (hasCalm) {
      normalizedTags.add("calma");
    }

    if (normalizedTags.size > 0) {
      taggedTradesCount++;
    }

    const parsed = parseTradeContent(entry.content ?? "");
    const pnl = extractProfitFromEntry(entry);
    const rVal = parsed?.returnPct ?? (pnl > 0 ? 1.5 : pnl < 0 ? -1.0 : 0);
    const isWin = entry.result === "win" || pnl > 0;

    let hasVirtue = false;
    let hasLeak = false;

    for (const tagId of normalizedTags) {
      if (tagCounts[tagId]) {
        tagCounts[tagId].count += 1;
        tagCounts[tagId].pnl += pnl;
        tagCounts[tagId].totalR += rVal;
        if (isWin) tagCounts[tagId].wins += 1;
      }

      if (VIRTU_TAGS.some((v) => v.id === tagId)) {
        hasVirtue = true;
        totalVirtueCount += 1;
      }
      if (LEAK_TAGS.some((l) => l.id === tagId)) {
        hasLeak = true;
        totalLeakCount += 1;
      }
    }

    if (hasVirtue && pnl > 0) {
      virtueYield += pnl;
    }
    if (hasLeak && pnl < 0) {
      leakBleed += Math.abs(pnl);
    }
  }

  const denominator = Math.max(1, totalTrades);

  const virtueMetrics: TagMetric[] = VIRTU_TAGS.map((vt) => {
    const data = tagCounts[vt.id] || { count: 0, pnl: 0, wins: 0, totalR: 0 };
    const winRate = data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0;
    const avgR = data.count > 0 ? Math.round((data.totalR / data.count) * 10) / 10 : 0;
    const frequencyPct = Math.round((data.count / denominator) * 100);
    // Score reflects presence and win-rate synergy
    const normalizedScore = Math.min(100, Math.max(0, Math.round(frequencyPct * 1.5 + winRate * 0.4)));

    return {
      id: vt.id,
      label: vt.label,
      icon: vt.icon,
      isPositive: true,
      count: data.count,
      frequencyPct,
      totalPnl: Math.round(data.pnl * 100) / 100,
      winRate,
      avgR,
      normalizedScore,
    };
  });

  const leakMetrics: TagMetric[] = LEAK_TAGS.map((lt) => {
    const data = tagCounts[lt.id] || { count: 0, pnl: 0, wins: 0, totalR: 0 };
    const winRate = data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0;
    const avgR = data.count > 0 ? Math.round((data.totalR / data.count) * 10) / 10 : 0;
    const frequencyPct = Math.round((data.count / denominator) * 100);
    // Leak severity score: higher frequency = worse breach
    const normalizedScore = Math.min(100, Math.max(0, Math.round(frequencyPct * 2.0)));

    return {
      id: lt.id,
      label: lt.label,
      icon: lt.icon,
      isPositive: false,
      count: data.count,
      frequencyPct,
      totalPnl: Math.round(data.pnl * 100) / 100,
      winRate,
      avgR,
      normalizedScore,
    };
  });

  const allMetrics = [...virtueMetrics, ...leakMetrics];

  const totalPoints = totalVirtueCount + totalLeakCount;
  const integrityScore =
    totalPoints > 0
      ? Math.round((totalVirtueCount / totalPoints) * 100)
      : totalTrades > 0
        ? 100
        : 100;

  // Find dominant virtue (highest positive P&L or highest count)
  const dominantVirtue =
    virtueMetrics.filter((v) => v.count > 0).sort((a, b) => b.totalPnl - a.totalPnl || b.count - a.count)[0] ?? null;

  // Find critical leak (most negative P&L or highest count)
  const criticalLeak =
    leakMetrics.filter((l) => l.count > 0).sort((a, b) => a.totalPnl - b.totalPnl || b.count - a.count)[0] ?? null;

  return {
    virtueMetrics,
    leakMetrics,
    allMetrics,
    totalTradesAnalyzed: totalTrades,
    taggedTradesCount,
    integrityScore,
    virtueYield: Math.round(virtueYield * 100) / 100,
    leakBleed: Math.round(leakBleed * 100) / 100,
    dominantVirtue,
    criticalLeak,
  };
}

export interface DisciplineVirtueRadarProps {
  entries: JournalEntry[];
  currentEntry?: JournalEntry | null;
  className?: string;
  compact?: boolean;
}

export function DisciplineVirtueRadar({
  entries,
  currentEntry,
  className,
  compact = false,
}: DisciplineVirtueRadarProps) {
  const analysis = useMemo(() => computeDisciplineAnalysis(entries), [entries]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Active tags on current trade
  const currentTradeActiveTags = useMemo(() => {
    if (!currentEntry?.tags) return new Set<string>();
    const tags = currentEntry.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const set = new Set(tags);
    if (
      tags.some((t) => t === "calma" || t === "respiro-478" || t === "respiro") ||
      (currentEntry.content ?? "").toLowerCase().includes("respiro tattico")
    ) {
      set.add("calma");
    }
    return set;
  }, [currentEntry?.tags, currentEntry?.content]);

  // SVG Geometry Dimensions
  const size = compact ? 260 : 340;
  const cx = size / 2;
  const cy = size / 2 - (compact ? 6 : 10);
  const maxR = compact ? 75 : 105;

  // Spoke Angles: 0 to allMetrics.length - 1
  // Order: Virtues (top/right quadrant) -> Leaks (bottom/left quadrants)
  const angles = useMemo(() => {
    const totalSpokes = Math.max(1, analysis.allMetrics.length);
    return analysis.allMetrics.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / totalSpokes);
  }, [analysis.allMetrics]);

  // Reference Concentric Octagon Rings
  const getRingPoints = (fraction: number) => {
    const r = maxR * fraction;
    return angles
      .map((angle) => {
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Data Polygon Points for Virtues
  const virtuePolygonPoints = useMemo(() => {
    const pts: string[] = [`${cx},${cy}`];
    analysis.virtueMetrics.forEach((vm, i) => {
      const fraction = Math.max(0.1, Math.min(1.0, vm.normalizedScore / 100));
      const r = maxR * fraction;
      const angle = angles[i];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    pts.push(`${cx},${cy}`);
    return pts.join(" ");
  }, [analysis.virtueMetrics, angles, cx, cy, maxR]);

  // Data Polygon Points for Leaks
  const leakPolygonPoints = useMemo(() => {
    const pts: string[] = [`${cx},${cy}`];
    const offset = analysis.virtueMetrics.length;
    analysis.leakMetrics.forEach((lm, i) => {
      const idx = offset + i;
      const fraction = Math.max(0.1, Math.min(1.0, lm.normalizedScore / 100));
      const r = maxR * fraction;
      const angle = angles[idx];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    pts.push(`${cx},${cy}`);
    return pts.join(" ");
  }, [analysis.leakMetrics, analysis.virtueMetrics.length, angles, cx, cy, maxR]);

  // Active or hovered metric detail
  const activeDetail = useMemo(() => {
    if (!selectedTagId) {
      return analysis.criticalLeak || analysis.dominantVirtue || analysis.allMetrics[0];
    }
    return analysis.allMetrics.find((m) => m.id === selectedTagId) ?? null;
  }, [selectedTagId, analysis]);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-[#07080b]/90 p-3 sm:p-4 shadow-2xl flex flex-col gap-3 font-mono select-none",
        className,
      )}
    >
      {/* ── HEADER TELEMETRICO ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-[#C5A059] shrink-0" />
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-hi">
              Mappa Radiale Virtù &amp; Leak
            </span>
            <span className="block text-[8.5px] text-text-lo">
              Costellazione di disciplina su {analysis.totalTradesAnalyzed} Trade
            </span>
          </div>
        </div>

        {/* Global Integrity Index Badge */}
        <div className="flex items-center gap-1.5 bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 rounded">
          <span className="text-[8.5px] uppercase tracking-wider text-text-lo">Integrità:</span>
          <span
            className={cn(
              "font-bold text-xs whitespace-nowrap",
              analysis.integrityScore >= 75
                ? "text-success"
                : analysis.integrityScore >= 50
                  ? "text-[#E8C56A]"
                  : "text-destructive",
            )}
          >
            {analysis.integrityScore}%
          </span>
        </div>
      </div>

      {/* ── RADAR SVG CANVAS ── */}
      <div className="relative flex items-center justify-center min-h-[220px]">
        <svg
          viewBox={`0 0 ${size} ${size - (compact ? 20 : 10)}`}
          className="w-full max-w-[340px] h-auto overflow-visible"
        >
          <defs>
            {/* Emerald Gradient for Virtues */}
            <radialGradient id="virtueGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </radialGradient>
            {/* Ruby Gradient for Leaks */}
            <radialGradient id="leakGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </radialGradient>
          </defs>

          {/* 1. Concentric Reference Octagons */}
          {[0.25, 0.5, 0.75, 1.0].map((frac) => (
            <polygon
              key={frac}
              points={getRingPoints(frac)}
              fill="none"
              stroke="rgba(197, 160, 89, 0.14)"
              strokeWidth={frac === 1.0 ? "1.2" : "0.75"}
              strokeDasharray={frac === 1.0 ? "none" : "2,2"}
            />
          ))}

          {/* 2. Spoke Radii from Center */}
          {angles.map((angle, i) => {
            const x = cx + maxR * Math.cos(angle);
            const y = cy + maxR * Math.sin(angle);
            const isVirtue = i < analysis.virtueMetrics.length;
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={isVirtue ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}
                strokeWidth="1"
              />
            );
          })}

          {/* 3. Filled Virtue Polygon */}
          <polygon
            points={virtuePolygonPoints}
            fill="url(#virtueGlow)"
            stroke="#10b981"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />

          {/* 4. Filled Leak Polygon */}
          <polygon
            points={leakPolygonPoints}
            fill="url(#leakGlow)"
            stroke="#ef4444"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />

          {/* 5. Center Golden Core */}
          <circle cx={cx} cy={cy} r="3" fill="#C5A059" opacity="0.8" />

          {/* 6. Spoke Vertices & Interactive Nodes */}
          {analysis.allMetrics.map((metric, i) => {
            const angle = angles[i];
            const fraction = Math.max(0.1, Math.min(1.0, metric.normalizedScore / 100));
            const r = maxR * fraction;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);

            // Label Position outside maxR
            const labelR = maxR + (compact ? 18 : 22);
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);

            const isCurrentTrade = currentTradeActiveTags.has(metric.id);
            const isSelected = selectedTagId === metric.id;

            return (
              <g
                key={metric.id}
                className="cursor-pointer group"
                onClick={() => setSelectedTagId(metric.id === selectedTagId ? null : metric.id)}
              >
                {/* Active Current Trade Halo Ring */}
                {isCurrentTrade && (
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill="none"
                    stroke="#E8C56A"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    className="animate-spin"
                    style={{ transformOrigin: `${x}px ${y}px`, animationDuration: "8s" }}
                  />
                )}

                {/* Vertex Circle Node */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? "5.5" : "3.5"}
                  fill={metric.isPositive ? "#10b981" : "#ef4444"}
                  stroke="#07080b"
                  strokeWidth="1.5"
                  className="transition-all duration-200 group-hover:scale-125"
                />

                {/* Spoke Label */}
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    "text-[8.5px] font-bold uppercase transition-all select-none",
                    isSelected
                      ? "fill-[#E8C56A] font-black"
                      : metric.isPositive
                        ? "fill-[#10b981]/90"
                        : "fill-[#ef4444]/90",
                  )}
                >
                  {metric.icon} {metric.label.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── BENTO TELEMETRY CARD: DETTAGLIO SELEZIONATO ── */}
      {activeDetail && (
        <div className="rounded-lg border border-white/[0.08] bg-[#0d0f14] p-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{activeDetail.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-text-hi text-[11px] truncate">{activeDetail.label}</span>
                <span
                  className={cn(
                    "px-1 py-0.2 rounded text-[7.5px] uppercase font-bold whitespace-nowrap",
                    activeDetail.isPositive
                      ? "bg-success/20 text-success border border-success/30"
                      : "bg-destructive/20 text-destructive border border-destructive/30",
                  )}
                >
                  {activeDetail.isPositive ? "Virtù" : "Leak"}
                </span>
              </div>
              <span className="text-[9px] text-text-lo">
                Rilevato in <strong className="text-text-hi font-mono">{activeDetail.count} Trade</strong> ({activeDetail.frequencyPct}%)
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[8px] uppercase tracking-wider text-text-lo">Impatto Finanziario</span>
            <span
              className={cn(
                "font-bold font-mono text-xs whitespace-nowrap",
                activeDetail.totalPnl >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {activeDetail.totalPnl >= 0 ? `+€${activeDetail.totalPnl.toFixed(2)}` : `-€${Math.abs(activeDetail.totalPnl).toFixed(2)}`}
            </span>
          </div>
        </div>
      )}

      {/* ── BENTO STRIP: EQUILIBRIO OPERATIVO & COSTO DELLA DERIVA ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-white/[0.06] pt-2 text-[9.5px]">
        <div className="rounded bg-surface-1 border border-border-subtle p-2 flex flex-col">
          <span className="text-[8px] uppercase text-text-lo flex items-center gap-1">
            <TrendingUp size={10} className="text-success" />
            Rendimento Virtù
          </span>
          <span className="font-bold font-mono text-success whitespace-nowrap mt-0.5">
            +€{analysis.virtueYield.toFixed(2)}
          </span>
        </div>

        <div className="rounded bg-surface-1 border border-border-subtle p-2 flex flex-col">
          <span className="text-[8px] uppercase text-text-lo flex items-center gap-1">
            <TrendingDown size={10} className="text-destructive" />
            Costo della Deriva
          </span>
          <span className="font-bold font-mono text-destructive whitespace-nowrap mt-0.5">
            -€{analysis.leakBleed.toFixed(2)}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded bg-surface-1 border border-border-subtle p-2 flex flex-col">
          <span className="text-[8px] uppercase text-text-lo flex items-center gap-1">
            <Target size={10} className="text-[#C5A059]" />
            Virtù Predominante
          </span>
          <span className="font-bold text-text-hi truncate mt-0.5">
            {analysis.dominantVirtue ? `${analysis.dominantVirtue.icon} ${analysis.dominantVirtue.label}` : "In osservazione"}
          </span>
        </div>
      </div>
    </div>
  );
}
