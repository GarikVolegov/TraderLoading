import type { ChartDrawing, ChartPoint, DrawingLineStyle } from "./chartAnalysisTypes";

export interface ScreenPoint {
  x: number;
  y: number;
}

export function normalizeRect(a: ScreenPoint, b: ScreenPoint): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function getLineStyleDashArray(style: DrawingLineStyle): string | undefined {
  if (style === "dashed") return "8 6";
  if (style === "dotted") return "2 5";
  return undefined;
}

export function getFibonacciLines(a: ChartPoint, b: ChartPoint, levels: number[]): Array<{ level: number; price: number }> {
  return levels.map((level) => ({
    level,
    price: a.price + (b.price - a.price) * level,
  }));
}

function distanceToSegment(point: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function hitTestDrawing(
  drawing: ChartDrawing,
  point: ScreenPoint,
  toScreen: (point: ChartPoint) => ScreenPoint | null,
): boolean {
  const a = toScreen(drawing.points[0]);
  const b = toScreen(drawing.points[1]);
  if (!a || !b) return false;
  if (drawing.kind === "rectangle") {
    const rect = normalizeRect(a, b);
    const edge = 8;
    const insideX = point.x >= rect.x - edge && point.x <= rect.x + rect.width + edge;
    const insideY = point.y >= rect.y - edge && point.y <= rect.y + rect.height + edge;
    const nearEdge =
      Math.abs(point.x - rect.x) <= edge ||
      Math.abs(point.x - (rect.x + rect.width)) <= edge ||
      Math.abs(point.y - rect.y) <= edge ||
      Math.abs(point.y - (rect.y + rect.height)) <= edge;
    return insideX && insideY && nearEdge;
  }
  return distanceToSegment(point, a, b) <= 8;
}
