import { createCanvas } from "@napi-rs/canvas";
import type { Candle } from "./candles.js";

// ─── Server-side candlestick chart renderer ─────────────────────────────────────
// Disegna un grafico a candele in PNG dalle OHLC, usato sia per l'analisi on-demand
// sia per lo scanner autonomo (nessun browser disponibile lato server). La palette
// rispecchia il tema della dashboard (ChartReplay.tsx) così che le immagini lette
// dal modello vision siano coerenti fra le due modalità.

const BG = "#090f1f";
const GRID = "rgba(255,255,255,0.05)";
const UP = "#10b981";
const DOWN = "#ef4444";
const AXIS_TEXT = "#9ca3af";
const SL_COLOR = "#ef4444";
const TP_COLOR = "#10b981";
const ENTRY_COLOR = "#eab308";

export interface RenderOptions {
  symbol: string;
  interval: string;
  candles: Candle[];
  width?: number;
  height?: number;
  levels?: { sl?: number | null; tp?: number | null; entry?: number | null };
  maxCandles?: number;
}

function decimalsFor(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 3;
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC")) return 1;
  if (s.includes("ETH")) return 2;
  return 5;
}

/** Renderizza un grafico a candele in PNG e ritorna il Buffer. */
export function renderCandleChartPng(opts: RenderOptions): Buffer {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 576;
  const maxCandles = opts.maxCandles ?? 120;
  const candles = opts.candles.slice(-maxCandles);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Sfondo
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const padLeft = 12;
  const padRight = 72;   // spazio per le label di prezzo
  const padTop = 36;     // spazio per il titolo
  const padBottom = 28;  // spazio per le label tempo
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  if (candles.length === 0) {
    ctx.fillStyle = AXIS_TEXT;
    ctx.font = "16px sans-serif";
    ctx.fillText("Nessun dato disponibile", padLeft + 20, padTop + 40);
    return canvas.toBuffer("image/png");
  }

  // Range prezzi (includendo eventuali livelli SL/TP/entry)
  let min = Infinity, max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  for (const lvl of [opts.levels?.sl, opts.levels?.tp, opts.levels?.entry]) {
    if (lvl != null) {
      if (lvl < min) min = lvl;
      if (lvl > max) max = lvl;
    }
  }
  const range = max - min || 1;
  const pad = range * 0.08;
  min -= pad;
  max += pad;
  const span = max - min || 1;

  const yFor = (price: number) => padTop + plotH - ((price - min) / span) * plotH;
  const decimals = decimalsFor(opts.symbol);

  // Griglia orizzontale + label prezzo
  ctx.strokeStyle = GRID;
  ctx.fillStyle = AXIS_TEXT;
  ctx.font = "11px monospace";
  ctx.lineWidth = 1;
  const gridLines = 6;
  for (let i = 0; i <= gridLines; i++) {
    const price = min + (span * i) / gridLines;
    const y = yFor(price);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
    ctx.fillText(price.toFixed(decimals), padLeft + plotW + 6, y + 3);
  }

  // Candele
  const n = candles.length;
  const slot = plotW / n;
  const bodyW = Math.max(1, Math.min(slot * 0.7, 14));
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const cx = padLeft + slot * i + slot / 2;
    const up = c.close >= c.open;
    const color = up ? UP : DOWN;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // Stoppino
    ctx.beginPath();
    ctx.moveTo(cx, yFor(c.high));
    ctx.lineTo(cx, yFor(c.low));
    ctx.stroke();

    // Corpo
    const yOpen = yFor(c.open);
    const yClose = yFor(c.close);
    const top = Math.min(yOpen, yClose);
    const h = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(cx - bodyW / 2, top, bodyW, h);
  }

  // Livelli SL / TP / Entry (linee tratteggiate)
  const drawLevel = (price: number | null | undefined, color: string, label: string) => {
    if (price == null) return;
    const y = yFor(price);
    ctx.strokeStyle = color;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "bold 11px monospace";
    ctx.fillText(`${label} ${price.toFixed(decimals)}`, padLeft + 4, y - 4);
  };
  drawLevel(opts.levels?.entry, ENTRY_COLOR, "ENTRY");
  drawLevel(opts.levels?.sl, SL_COLOR, "SL");
  drawLevel(opts.levels?.tp, TP_COLOR, "TP");

  // Label tempo (prima / ultima candela)
  ctx.fillStyle = AXIS_TEXT;
  ctx.font = "11px monospace";
  const fmt = (t: number) => new Date(t * 1000).toISOString().slice(0, 16).replace("T", " ");
  ctx.fillText(fmt(candles[0].time), padLeft, height - 10);
  const lastLabel = fmt(candles[n - 1].time);
  ctx.fillText(lastLabel, padLeft + plotW - ctx.measureText(lastLabel).width, height - 10);

  // Titolo
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(`${opts.symbol}  ·  ${opts.interval}  ·  ${n} candele`, padLeft, 22);

  return canvas.toBuffer("image/png");
}

/** Converte un buffer PNG in data-url base64 per l'invio al modello vision. */
export function bufferToDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}
