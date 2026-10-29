import React, { useState, useCallback, useRef, useEffect } from "react";
import { type VarcoSetupPlan } from "@workspace/api-client-react";
import { Shield, Zap, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ChartProjector } from "@/components/backtest-terminal/PositionOverlay";
import { LimenSentinelChartGadget } from "./LimenSentinelChartGadget";
import "./LimenAiSetupOverlay.css";

interface LimenAiActiveZone {
  topPrice: number;
  bottomPrice: number;
  triggerType: string;
  label: string;
}

interface LimenAiSchematicPoint {
  time: number;
  price: number;
  label: string;
}

interface LimenAiSchematicBox {
  startTime: number;
  endTime: number;
  topPrice: number;
  bottomPrice: number;
  rangeHeight: number;
  schematicType: "accumulation" | "distribution" | "reaccumulation" | "redistribution";
  causeStage?: "causa_1" | "causa_2_redistrib" | "causa_2_reaccum";
  tenPercentLevel: number;
  tenPercent2Level?: number;
  arPrice?: number;
  scPrice?: number;
  stbPrice?: number;
  springPrice?: number;
  utadPrice?: number;
  pocPrice: number;
  equilibriumPrice?: number;
  creekPrice?: number;
  icePrice?: number;
  jtcZoneTop?: number;
  jtcZoneBottom?: number;
  testZoneTop?: number;
  testZoneBottom?: number;
  phase?: string;
}

export type ExtendedVarcoSetupPlan = VarcoSetupPlan & {
  activeZone?: LimenAiActiveZone;
  schematicPoints?: LimenAiSchematicPoint[];
  schematicBox?: LimenAiSchematicBox;
};

interface LimenAiSetupOverlayProps {
  setup?: ExtendedVarcoSetupPlan | null;
  projector: ChartProjector;
  symbol: string;
  onUpdateSetup?: (setup: ExtendedVarcoSetupPlan) => void;
  onAdoptSetup?: () => void;
  onClose?: () => void;
  isScanning?: boolean;
  onScan?: () => void;
  showFloatingGadget?: boolean;
}

export function LimenAiSetupOverlay({
  setup,
  projector,
  symbol,
  onUpdateSetup,
  onAdoptSetup,
  onClose,
  isScanning = false,
  onScan,
  showFloatingGadget = false,
}: LimenAiSetupOverlayProps) {
  const [draggingLevel, setDraggingLevel] = useState<"entry" | "stop" | "tp1" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── HOOKS: devono essere sempre chiamati incondizionatamente all'inizio ──
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!setup || !draggingLevel || !containerRef.current || !onUpdateSetup) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientY = e.clientY - rect.top;
      const newPrice = projector.priceForY(clientY);
      if (newPrice == null || !Number.isFinite(newPrice)) return;

      const roundedPrice = Number(newPrice.toFixed(symbol.includes("JPY") ? 3 : symbol === "XAUUSD" ? 2 : 5));
      const isLong = setup.direction === "long";

      if (draggingLevel === "entry") {
        const diff = Math.abs(roundedPrice - setup.stopLossPrice);
        const newBE = isLong ? roundedPrice + diff * 1.5 : roundedPrice - diff * 1.5;
        const newTP1 = isLong ? roundedPrice + diff * 3.0 : roundedPrice - diff * 3.0;
        const newTP2 = isLong ? roundedPrice + diff * 4.5 : roundedPrice - diff * 4.5;
        onUpdateSetup({
          ...setup,
          entryPrice: roundedPrice,
          breakEvenPrice: Number(newBE.toFixed(2)),
          takeProfit1Price: Number(newTP1.toFixed(2)),
          takeProfit2Price: Number(newTP2.toFixed(2)),
        });
      } else if (draggingLevel === "stop") {
        const diff = Math.abs(setup.entryPrice - roundedPrice);
        const newBE = isLong ? setup.entryPrice + diff * 1.5 : setup.entryPrice - diff * 1.5;
        const newTP1 = isLong ? setup.entryPrice + diff * 3.0 : setup.entryPrice - diff * 3.0;
        const newTP2 = isLong ? setup.entryPrice + diff * 4.5 : setup.entryPrice - diff * 4.5;
        onUpdateSetup({
          ...setup,
          stopLossPrice: roundedPrice,
          breakEvenPrice: Number(newBE.toFixed(2)),
          takeProfit1Price: Number(newTP1.toFixed(2)),
          takeProfit2Price: Number(newTP2.toFixed(2)),
        });
      } else if (draggingLevel === "tp1") {
        const risk = Math.abs(setup.entryPrice - setup.stopLossPrice);
        const reward = Math.abs(roundedPrice - setup.entryPrice);
        const newRR = risk > 0 ? Number((reward / risk).toFixed(1)) : 3.0;
        onUpdateSetup({
          ...setup,
          takeProfit1Price: roundedPrice,
          riskRewardRatio: newRR,
        });
      }
    },
    [draggingLevel, onUpdateSetup, projector, setup, symbol],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingLevel(null);
  }, []);

  useEffect(() => {
    if (!draggingLevel) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingLevel, handleMouseMove, handleMouseUp]);

  const handleMouseDown = (level: "entry" | "stop" | "tp1", e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingLevel(level);
  };

  const width = projector.width || 800;
  const height = projector.height || 600;
  const paneWidth = projector.paneWidth || width;
  const paneHeight = projector.paneHeight || height;

  // Se non c'è setup ma c'è scansione attiva, mostra il gadget scansionatore solo se abilitato
  if (!setup) {
    if (!isScanning || !showFloatingGadget) return null;
    return (
      <div ref={containerRef} className="limen-ai-setup-overlay pointer-events-none" aria-label="Visualizzazione Setup IA">
        <LimenSentinelChartGadget
          isScanning={isScanning}
          setup={null}
          symbol={symbol}
          containerWidth={width}
          containerHeight={height}
          onAdoptSetup={onAdoptSetup}
          onScan={onScan}
          onClose={onClose}
        />
      </div>
    );
  }

  const isLong = setup.direction === "long";

  // Coordinate proiettate Y
  const yEntry = projector.yForPrice(setup.entryPrice);
  const yStop = projector.yForPrice(setup.stopLossPrice);
  const yBE = projector.yForPrice(setup.breakEvenPrice);
  const yTP1 = projector.yForPrice(setup.takeProfit1Price);
  const yTP2 = projector.yForPrice(setup.takeProfit2Price);

  if (yEntry == null || yStop == null) return null;

  // Calcolo altezze e posizioni dei rettangoli di rischio e profitto
  const stopRectTop = Math.min(yEntry, yStop);
  const stopRectHeight = Math.max(2, Math.abs(yStop - yEntry));

  const tp1RectTop = yTP1 != null ? Math.min(yEntry, yTP1) : 0;
  const tp1RectHeight = yTP1 != null ? Math.max(2, Math.abs(yTP1 - yEntry)) : 0;

  // Delimitazione orizzontale della proiezione ordini (Risk/Reward): solo dal trigger/fine schematica verso destra
  const boxEnd = setup.schematicBox ? projector.xForTime(setup.schematicBox.endTime) : null;
  const xLatest = projector.xForTime(Date.now() / 1000) ?? Math.max(0, width - 260);
  const defaultBracketStart = boxEnd != null ? Math.max(0, Math.min(paneWidth - 240, boxEnd + 10)) : Math.max(0, xLatest);
  const bracketLeft = Math.max(0, Math.min(paneWidth - 220, defaultBracketStart));
  const bracketWidth = Math.max(140, paneWidth - 10 - bracketLeft);

  return (
    <div ref={containerRef} className="limen-ai-setup-overlay" aria-label="Visualizzazione Setup IA">
      {/* 0. Box Causa Trading Range Wyckoff (Accumulo, Riaccumulo, Distribuzione, Ridistribuzione) */}
      {setup.schematicBox && (() => {
        const box = setup.schematicBox;
        const xStart = projector.xForTime(box.startTime);
        const xEnd = projector.xForTime(box.endTime) ?? width;
        const yTop = projector.yForPrice(box.topPrice);
        const yBottom = projector.yForPrice(box.bottomPrice);
        const y10 = projector.yForPrice(box.tenPercentLevel);
        const y10_2 = box.tenPercent2Level ? projector.yForPrice(box.tenPercent2Level) : null;
        const yPoc = projector.yForPrice(box.pocPrice);
        const yCreek = box.creekPrice ? projector.yForPrice(box.creekPrice) : null;
        const yIce = box.icePrice ? projector.yForPrice(box.icePrice) : null;
        const yEq = box.equilibriumPrice ? projector.yForPrice(box.equilibriumPrice) : null;

        if (yTop == null || yBottom == null) return null;
        const boxTop = Math.min(yTop, yBottom);
        const boxHeight = Math.max(8, Math.abs(yBottom - yTop));
        const boxLeft = xStart != null ? Math.max(0, xStart - 8) : 0;
        const boxWidth = xStart != null ? Math.max(80, (xEnd ?? width) - boxLeft + 20) : width;

        const isAccum = box.schematicType === "accumulation";
        const isReaccum = box.schematicType === "reaccumulation" || box.causeStage === "causa_2_reaccum";
        const isRedistrib = box.schematicType === "redistribution" || box.causeStage === "causa_2_redistrib";

        const titleText = isReaccum
          ? `CAUSA 2: RIACCUMULO (2° MARKUP HTF) · ${box.phase || "FASE C"}`
          : isRedistrib
          ? `CAUSA 2: RIDISTRIBUZIONE (2° MARKDOWN HTF) · ${box.phase || "FASE C"}`
          : isAccum
          ? `CAUSA 1: ACCUMULAZIONE PRIMARIA · ${box.phase || "FASE C"}`
          : `CAUSA 1: DISTRIBUZIONE PRIMARIA · ${box.phase || "FASE C"}`;

        const boxClass = isReaccum
          ? "is-reaccum"
          : isRedistrib
          ? "is-redistrib"
          : isAccum
          ? "is-accum"
          : "is-distrib";

        // Verifica anti-collisione tra Creek e 10% Apollo
        const creekTenDiff = yCreek != null && y10 != null ? Math.abs(yCreek - y10) : 999;
        const areCreekAnd10Merged = creekTenDiff < 14;

        return (
          <div
            className={`limen-wyckoff-range-box ${boxClass}`}
            style={{
              top: `${boxTop}px`,
              height: `${boxHeight}px`,
              left: `${boxLeft}px`,
              width: `${boxWidth}px`,
            }}
          >
            <div className="limen-wyckoff-box-header">
              <span className="limen-wyckoff-box-title">{titleText}</span>
            </div>

            {/* Creek Line e/o 10% Apollo con anti-collisione */}
            {areCreekAnd10Merged ? (
              yCreek != null && (
                <div
                  className="limen-wyckoff-creek-line"
                  style={{ top: `${Math.max(0, yCreek - boxTop)}px` }}
                  title={`Creek Line & 10% Apollo @ ${box.creekPrice ?? box.tenPercentLevel}`}
                >
                  <span className="limen-wyckoff-creek-badge">
                    {`CREEK · 10% @ ${box.creekPrice ?? box.tenPercentLevel}`}
                  </span>
                </div>
              )
            ) : (
              <>
                {yCreek != null && (
                  <div
                    className="limen-wyckoff-creek-line"
                    style={{ top: `${Math.max(0, yCreek - boxTop)}px` }}
                    title={`Creek Line / Resistenza Wyckoff @ ${box.creekPrice}`}
                  >
                    <span className="limen-wyckoff-creek-badge">{`CREEK @ ${box.creekPrice}`}</span>
                  </div>
                )}
                {y10 != null && (
                  <div
                    className="limen-wyckoff-10pct-line"
                    style={{ top: `${Math.max(0, y10 - boxTop)}px` }}
                    title={`Livello 10% Apollo @ ${box.tenPercentLevel}`}
                  >
                    <span className="limen-wyckoff-10pct-badge">
                      {`10% APOLLO @ ${box.tenPercentLevel}`}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Ice Line (Supporto inferiore / Range Bottom) */}
            {yIce != null && (
              <div
                className="limen-wyckoff-ice-line"
                style={{ top: `${Math.max(0, yIce - boxTop)}px` }}
                title={`Ice Line / Supporto Wyckoff @ ${box.icePrice}`}
              >
                <span className="limen-wyckoff-ice-badge">{`ICE @ ${box.icePrice}`}</span>
              </div>
            )}

            {/* 50% Equilibrium Line (Midpoint Matematico) */}
            {yEq != null && (
              <div
                className="limen-wyckoff-eq-line"
                style={{ top: `${Math.max(0, yEq - boxTop)}px` }}
                title={`Equilibrium 50% @ ${box.equilibriumPrice}`}
              >
                <span className="limen-wyckoff-eq-badge">{`EQ 50% @ ${box.equilibriumPrice}`}</span>
              </div>
            )}

            {/* Linea Livello 10% 2 (Rottura Confermata) */}
            {y10_2 != null && (
              <div
                className="limen-wyckoff-10pct2-line"
                style={{ top: `${Math.max(0, y10_2 - boxTop)}px` }}
                title={`Livello 10% 2 (Rottura Esterna @ ${box.tenPercent2Level})`}
              >
                <span className="limen-wyckoff-10pct2-badge">{`10% 2 @ ${box.tenPercent2Level}`}</span>
              </div>
            )}

            {/* Linea POC Volume Profile della Schematica (PS → 10% 2) */}
            {yPoc != null && (
              <div
                className="limen-wyckoff-poc-line"
                style={{ top: `${Math.max(0, yPoc - boxTop)}px` }}
                title={`Point of Control (PS → 10% 2 @ ${box.pocPrice})`}
              >
                <span className="limen-wyckoff-poc-badge">{`POC @ ${box.pocPrice}`}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* 0B. Box Dedicato Zona di Test (sull'ombra di STB o UT) - Delimitato al Range */}
      {setup.schematicBox?.testZoneTop != null && setup.schematicBox?.testZoneBottom != null && (() => {
        const yTop = projector.yForPrice(setup.schematicBox.testZoneTop);
        const yBottom = projector.yForPrice(setup.schematicBox.testZoneBottom);
        if (yTop == null || yBottom == null) return null;
        const zTop = Math.min(yTop, yBottom);
        const zHeight = Math.max(5, Math.abs(yBottom - yTop));
        const boxXStart = setup.schematicBox ? (projector.xForTime(setup.schematicBox.startTime) ?? 0) : 0;
        const boxXEnd = setup.schematicBox ? (projector.xForTime(setup.schematicBox.endTime) ?? width) : width;
        const zLeft = Math.max(0, boxXStart);
        const zWidth = Math.max(80, boxXEnd - zLeft + 15);
        return (
          <div
            className="limen-wyckoff-test-zone-box"
            style={{
              top: `${zTop}px`,
              height: `${zHeight}px`,
              left: `${zLeft}px`,
              width: `${zWidth}px`,
            }}
          >
            <span className="limen-wyckoff-test-zone-badge">ZONA DI TEST</span>
          </div>
        );
      })()}

      {/* 0C. Box Dedicato Zona JTC / BTI (tra 10% e AR) - Delimitato al Range */}
      {setup.schematicBox?.jtcZoneTop != null && setup.schematicBox?.jtcZoneBottom != null && (() => {
        const yTop = projector.yForPrice(setup.schematicBox.jtcZoneTop);
        const yBottom = projector.yForPrice(setup.schematicBox.jtcZoneBottom);
        if (yTop == null || yBottom == null) return null;
        const zTop = Math.min(yTop, yBottom);
        const zHeight = Math.max(6, Math.abs(yBottom - yTop));
        const boxXStart = setup.schematicBox ? (projector.xForTime(setup.schematicBox.startTime) ?? 0) : 0;
        const boxXEnd = setup.schematicBox ? (projector.xForTime(setup.schematicBox.endTime) ?? width) : width;
        const zLeft = Math.max(0, boxXStart);
        const zWidth = Math.max(90, boxXEnd - zLeft + 15);
        return (
          <div
            className="limen-wyckoff-jtc-zone-box"
            style={{
              top: `${zTop}px`,
              height: `${zHeight}px`,
              left: `${zLeft}px`,
              width: `${zWidth}px`,
            }}
          >
            <span className="limen-wyckoff-jtc-zone-badge">ZONA JTC (10% - AR)</span>
          </div>
        );
      })()}

      {/* Punti Strutturali della Schematica Wyckoff (Offset sopra/sotto le candele per non coprire il corpo) */}
      {setup.schematicPoints?.map((pt, idx) => {
        const x = projector.xForTime(pt.time);
        const y = projector.yForPrice(pt.price);
        if (x == null || y == null) return null;
        const isLong =
          setup.direction === "long" ||
          setup.schematicBox?.schematicType === "accumulation" ||
          setup.schematicBox?.schematicType === "reaccumulation";
        const cls = pt.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isHigh = isLong
          ? ["ar", "10", "102", "sos", "creek", "ut", "utad"].includes(cls)
          : ["bc", "st", "ut", "utad", "test", "psy", "creek"].includes(cls);
        const posClass = isHigh ? "is-high-marker" : "is-low-marker";
        return (
          <div
            key={`wyckoff-pt-${idx}-${pt.label}-${pt.time}`}
            className={`limen-schematic-marker ${posClass} is-${cls}`}
            style={{ left: `${x}px`, top: `${y}px` }}
            title={`${pt.label} @ ${pt.price}`}
          >
            {isHigh ? (
              <>
                <span className="limen-schematic-badge">{pt.label}</span>
                <span className="limen-schematic-dot" />
              </>
            ) : (
              <>
                <span className="limen-schematic-dot" />
                <span className="limen-schematic-badge">{pt.label}</span>
              </>
            )}
          </div>
        );
      })}

      {/* 1. Box Area Rischio (Stop Loss Zone) - Delimitata sulla destra dello schermo */}
      <div
        className="limen-ai-zone is-stop"
        style={{
          top: `${stopRectTop}px`,
          height: `${stopRectHeight}px`,
          left: `${bracketLeft}px`,
          width: `${bracketWidth}px`,
        }}
      />

      {/* 2. Box Area Guadagno Primario (TP1 Zone 1:3) - Delimitata sulla destra dello schermo */}
      {yTP1 != null && (
        <div
          className="limen-ai-zone is-profit"
          style={{
            top: `${tp1RectTop}px`,
            height: `${tp1RectHeight}px`,
            left: `${bracketLeft}px`,
            width: `${bracketWidth}px`,
          }}
        />
      )}

      {/* 3. Linea Entry - Ancorata a destra con tag sulla scala */}
      <div className="limen-ai-line is-entry" style={{ top: `${yEntry}px`, left: `${bracketLeft}px`, width: `${bracketWidth}px` }}>
        <div
          className="limen-ai-handle"
          onMouseDown={(e) => handleMouseDown("entry", e)}
          title="Trascina per spostare il prezzo di ingresso"
        />
        <div className="limen-ai-line-tag">
          <span className={`limen-ai-dir-badge ${isLong ? "is-long" : "is-short"}`}>
            {isLong ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            <span>
              {setup.orderType === "limit"
                ? `${setup.direction.toUpperCase()} LIMIT`
                : `ENTRY ${setup.direction.toUpperCase()}`}
            </span>
          </span>
          <span className="limen-ai-price font-mono">{setup.entryPrice}</span>
          <span className="limen-ai-lots font-mono">({setup.lotSize} Lots)</span>
        </div>
      </div>

      {/* 4. Linea Stop Loss */}
      <div className="limen-ai-line is-stop" style={{ top: `${yStop}px`, left: `${bracketLeft}px`, width: `${bracketWidth}px` }}>
        <div
          className="limen-ai-handle"
          onMouseDown={(e) => handleMouseDown("stop", e)}
          title="Trascina per modificare lo Stop Loss"
        />
        <div className="limen-ai-line-tag">
          <span className="limen-ai-tag-label flex items-center gap-1">
            <Shield size={11} />
            <span>STOP LOSS</span>
          </span>
          <span className="limen-ai-price font-mono">{setup.stopLossPrice}</span>
          <span className="limen-ai-pips font-mono">(-{setup.pipsRisk} pips)</span>
        </div>
      </div>

      {/* 5. Linea Break Even Trigger (Dinamica) */}
      {yBE != null && (
        <div className="limen-ai-line is-be" style={{ top: `${yBE}px`, left: `${bracketLeft}px`, width: `${bracketWidth}px` }}>
          <div className="limen-ai-line-tag">
            <span className="limen-ai-tag-label flex items-center gap-1 text-amber-400">
              <Zap size={11} />
              <span>BE TRIGGER (1:1.5R)</span>
            </span>
            <span className="limen-ai-price font-mono text-amber-300">{setup.breakEvenPrice}</span>
            <span className="limen-ai-sub text-[9px] text-amber-400/80">Pareggio</span>
          </div>
        </div>
      )}

      {/* 6. Linea TP1 (Presa Parziale 50% @ 1:3 R:R) */}
      {yTP1 != null && (
        <div className="limen-ai-line is-tp1" style={{ top: `${yTP1}px`, left: `${bracketLeft}px`, width: `${bracketWidth}px` }}>
          <div
            className="limen-ai-handle"
            onMouseDown={(e) => handleMouseDown("tp1", e)}
            title="Trascina per modificare il Target TP1"
          />
          <div className="limen-ai-line-tag">
            <span className="limen-ai-tag-label flex items-center gap-1 text-emerald-400">
              <Target size={11} />
              <span>TP1 PARZIALE</span>
            </span>
            <span className="limen-ai-price font-mono text-emerald-300">{setup.takeProfit1Price}</span>
            <span className="limen-ai-rr font-mono font-bold text-emerald-400">1:{setup.riskRewardRatio} R:R</span>
          </div>
        </div>
      )}

      {/* 7. Linea TP2 (Target Finale / Runner) */}
      {yTP2 != null && (
        <div className="limen-ai-line is-tp2" style={{ top: `${yTP2}px`, left: `${bracketLeft}px`, width: `${bracketWidth}px` }}>
          <div className="limen-ai-line-tag">
            <span className="limen-ai-tag-label flex items-center gap-1 text-teal-400">
              <Target size={11} />
              <span>TP2 RUNNER</span>
            </span>
            <span className="limen-ai-price font-mono text-teal-300">{setup.takeProfit2Price}</span>
          </div>
        </div>
      )}

      {/* 8. Mini Gadget Spostabile (Solo se esplicitamente richiesto - Adotta nel Varco) */}
      {showFloatingGadget && (
        <LimenSentinelChartGadget
          isScanning={isScanning}
          setup={setup}
          symbol={symbol}
          containerWidth={width}
          containerHeight={height}
          onAdoptSetup={onAdoptSetup}
          onScan={onScan}
          onClose={onClose}
        />
      )}
    </div>
  );
}
