import { useEffect, useMemo, useState, type PointerEvent } from "react";
import type { CandlestickData, Time } from "lightweight-charts";
import type { ChartAnalysisState, ChartDrawing, ChartPoint } from "./chartAnalysisTypes";
import { calculateVolumeProfile, type AnalysisCandle } from "./chartIndicators";
import { getSessionRangesForTime, getEuropeRomeDayRangeForTime } from "./chartSessionTime";
import { getFibonacciLines, getLineStyleDashArray, hitTestDrawing, normalizeRect, type ScreenPoint } from "./chartDrawingGeometry";

interface CoordinateApi {
  timeToCoordinate: (time: Time) => number | null;
  priceToCoordinate: (price: number) => number | null;
  coordinateToTime: (x: number) => Time | null;
  coordinateToPrice: (y: number) => number | null;
}

interface ChartAnalysisOverlayProps {
  width: number;
  height: number;
  visibleCandles: AnalysisCandle[];
  currentTime: number | null;
  analysisState: ChartAnalysisState;
  coordinateApi: CoordinateApi;
  interactionDisabled?: boolean;
  onCreateDrawing: (drawing: Omit<ChartDrawing, "id" | "createdAt">) => void;
  onSelectDrawing: (id: string | null) => void;
}

function toScreen(point: ChartPoint, api: CoordinateApi): ScreenPoint | null {
  const x = api.timeToCoordinate(point.time);
  const y = api.priceToCoordinate(point.price);
  return x == null || y == null ? null : { x, y };
}

function clampX(value: number, width: number): number {
  return Math.max(0, Math.min(width, value));
}

export function ChartAnalysisOverlay({
  width,
  height,
  visibleCandles,
  currentTime,
  analysisState,
  coordinateApi,
  interactionDisabled = false,
  onCreateDrawing,
  onSelectDrawing,
}: ChartAnalysisOverlayProps) {
  const [pendingPoint, setPendingPoint] = useState<ChartPoint | null>(null);
  const activeTime = currentTime ?? (visibleCandles.at(-1)?.time as number | undefined) ?? null;
  const dailyRange = activeTime == null ? null : getEuropeRomeDayRangeForTime(activeTime);
  const sessions = activeTime == null ? null : getSessionRangesForTime(activeTime);
  const volumeProfile = useMemo(() => {
    if (!dailyRange || !analysisState.indicators.volumeProfile.enabled) return null;
    return calculateVolumeProfile(visibleCandles, dailyRange, analysisState.indicators.volumeProfile);
  }, [analysisState.indicators.volumeProfile, dailyRange, visibleCandles]);

  useEffect(() => {
    setPendingPoint(null);
  }, [analysisState.activeTool, interactionDisabled, width, height]);

  const createPointFromEvent = (event: PointerEvent<SVGSVGElement>): ChartPoint | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = coordinateApi.coordinateToTime(x);
    const price = coordinateApi.coordinateToPrice(y);
    return time == null || price == null ? null : { time, price };
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (interactionDisabled || analysisState.activeTool === "select") return;
    const point = createPointFromEvent(event);
    if (!point) return;
    if (!pendingPoint) {
      setPendingPoint(point);
      return;
    }
    onCreateDrawing({
      kind: analysisState.activeTool,
      points: [pendingPoint, point],
      style: analysisState.defaultDrawingStyle,
      ...(analysisState.activeTool === "fibonacci" ? { levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] } : {}),
    } as Omit<ChartDrawing, "id" | "createdAt">);
    setPendingPoint(null);
  };

  const handleSelectPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (interactionDisabled || analysisState.activeTool !== "select") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const selected = findDrawingAtPoint(
      analysisState.drawings,
      point,
      (chartPoint) => toScreen(chartPoint, coordinateApi),
    );
    onSelectDrawing(selected);
  };

  const overlayInteractive = !interactionDisabled && (analysisState.activeTool !== "select" || analysisState.drawings.length > 0);
  const cursorClass = analysisState.activeTool === "select" ? "cursor-default" : "cursor-crosshair";

  return (
    <svg
      data-testid="chart-analysis-overlay"
      className={`absolute inset-0 z-10 h-full w-full ${interactionDisabled ? "pointer-events-none" : overlayInteractive ? `pointer-events-auto ${cursorClass}` : "pointer-events-none"}`}
      width={width}
      height={height}
      onPointerDown={analysisState.activeTool === "select" ? handleSelectPointerDown : handlePointerDown}
    >
      {sessions && (
        <g pointerEvents="none">
          {(Object.keys(sessions) as Array<keyof typeof sessions>).map((id) => {
            const settings = analysisState.sessionBoxes[id];
            if (!settings.enabled) return null;
            const range = sessions[id];
            const startX = coordinateApi.timeToCoordinate(range.start as Time);
            const endX = coordinateApi.timeToCoordinate(range.end as Time);
            if (startX == null || endX == null) return null;
            const x = clampX(Math.min(startX, endX), width);
            const x2 = clampX(Math.max(startX, endX), width);
            const boxWidth = Math.max(0, x2 - x);
            if (boxWidth <= 0) return null;
            return (
              <g key={id}>
                <rect x={x} y={0} width={boxWidth} height={height} fill={settings.color} opacity={settings.opacity} />
                {settings.showBorders && (
                  <>
                    <line x1={x} x2={x} y1={0} y2={height} stroke={settings.color} strokeOpacity={0.42} strokeDasharray="4 5" />
                    <line x1={x2} x2={x2} y1={0} y2={height} stroke={settings.color} strokeOpacity={0.3} strokeDasharray="4 5" />
                  </>
                )}
                <text x={Math.max(8, x + 6)} y={18} fill={settings.color} fontSize={11} fontWeight={700}>
                  {settings.label}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {volumeProfile && volumeProfile.totalVolume > 0 && (
        <g pointerEvents="none" opacity={analysisState.indicators.volumeProfile.opacity}>
          {volumeProfile.buckets.map((bucket) => {
            const y1 = coordinateApi.priceToCoordinate(bucket.priceHigh);
            const y2 = coordinateApi.priceToCoordinate(bucket.priceLow);
            if (y1 == null || y2 == null) return null;
            const maxVolume = Math.max(...volumeProfile.buckets.map((item) => item.volume));
            const barWidth = maxVolume > 0 ? (bucket.volume / maxVolume) * analysisState.indicators.volumeProfile.width : 0;
            const x = analysisState.indicators.volumeProfile.side === "right" ? width - barWidth - 6 : 6;
            return (
              <rect
                key={`${bucket.priceLow}-${bucket.priceHigh}`}
                x={x}
                y={Math.min(y1, y2)}
                width={barWidth}
                height={Math.max(1, Math.abs(y2 - y1))}
                fill={bucket.inValueArea ? analysisState.indicators.volumeProfile.valueAreaColor : analysisState.indicators.volumeProfile.barColor}
              />
            );
          })}
          {(() => {
            const pocY = coordinateApi.priceToCoordinate((volumeProfile.poc.priceLow + volumeProfile.poc.priceHigh) / 2);
            return pocY == null ? null : (
              <line x1={0} x2={width} y1={pocY} y2={pocY} stroke={analysisState.indicators.volumeProfile.pocColor} strokeWidth={1} strokeDasharray="6 4" />
            );
          })()}
        </g>
      )}

      {analysisState.drawings.map((drawing) => {
        const a = toScreen(drawing.points[0], coordinateApi);
        const b = toScreen(drawing.points[1], coordinateApi);
        if (!a || !b) return null;
        const selected = drawing.id === analysisState.selectedDrawingId;
        const common = {
          stroke: drawing.style.stroke,
          strokeWidth: selected ? drawing.style.strokeWidth + 1 : drawing.style.strokeWidth,
          opacity: drawing.style.opacity,
          strokeDasharray: getLineStyleDashArray(drawing.style.lineStyle),
          pointerEvents: "visibleStroke" as const,
          onPointerDown: (event: PointerEvent<SVGElement>) => {
            event.stopPropagation();
            if (interactionDisabled) return;
            onSelectDrawing(drawing.id);
          },
        };
        if (drawing.kind === "rectangle") {
          const rect = normalizeRect(a, b);
          return <rect key={drawing.id} {...rect} {...common} fill={drawing.style.fill} fillOpacity={drawing.style.fillOpacity} pointerEvents="all" />;
        }
        if (drawing.kind === "fibonacci") {
          return (
            <g key={drawing.id}>
              {getFibonacciLines(drawing.points[0], drawing.points[1], drawing.levels).map((line) => {
                const y = coordinateApi.priceToCoordinate(line.price);
                return y == null ? null : (
                  <line key={line.level} x1={Math.min(a.x, b.x)} x2={Math.max(a.x, b.x)} y1={y} y2={y} {...common} />
                );
              })}
            </g>
          );
        }
        return <line key={drawing.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />;
      })}

      {pendingPoint && (() => {
        const point = toScreen(pendingPoint, coordinateApi);
        return point ? <circle cx={point.x} cy={point.y} r={4} fill={analysisState.defaultDrawingStyle.stroke} /> : null;
      })()}
    </svg>
  );
}

export function findDrawingAtPoint(
  drawings: ChartDrawing[],
  point: ScreenPoint,
  toScreenPoint: (point: ChartPoint) => ScreenPoint | null,
): string | null {
  return drawings.findLast((drawing) => hitTestDrawing(drawing, point, toScreenPoint))?.id ?? null;
}
