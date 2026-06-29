// Pure helpers for the Diario equity curve: realized cumulative-R series and a
// Monte-Carlo projection resampled from the user's own per-trade R distribution.
// Ported deterministically from the design kit (design-ref/diario/journal-view.jsx).

export function cumulativeR(rSamples: number[], start = 0): number[] {
  const out = [start];
  let cum = start;
  for (const r of rSamples) {
    cum += r;
    out.push(cum);
  }
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export interface ProjectionBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  samplePaths: number[][];
}

export function monteCarloBands(
  rSamples: number[],
  opts: { steps: number; start: number; sims?: number; seed?: number; samplePathCount?: number },
): ProjectionBands {
  const { steps, start, sims = 300, seed = 20260619, samplePathCount = 14 } = opts;
  const cols: number[][] = Array.from({ length: steps + 1 }, () => []);
  const samplePaths: number[][] = [];

  if (rSamples.length === 0) {
    const flat = Array.from({ length: steps + 1 }, () => start);
    return { p10: [...flat], p25: [...flat], p50: [...flat], p75: [...flat], p90: [...flat], samplePaths: [] };
  }

  const rnd = mulberry32(seed);
  for (let s = 0; s < sims; s++) {
    let cum = start;
    const path = [start];
    cols[0].push(start);
    for (let k = 1; k <= steps; k++) {
      cum += rSamples[Math.floor(rnd() * rSamples.length)];
      path.push(cum);
      cols[k].push(cum);
    }
    if (s < samplePathCount) samplePaths.push(path);
  }

  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  for (const c of cols) {
    const sorted = [...c].sort((a, b) => a - b);
    p10.push(quantile(sorted, 0.1));
    p25.push(quantile(sorted, 0.25));
    p50.push(quantile(sorted, 0.5));
    p75.push(quantile(sorted, 0.75));
    p90.push(quantile(sorted, 0.9));
  }
  return { p10, p25, p50, p75, p90, samplePaths };
}
