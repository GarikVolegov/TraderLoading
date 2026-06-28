/**
 * Width (percent, 0..100) of a COT diverging bar: the currency's |net| scaled
 * against the largest |net| in the displayed set. Returns 0 for non-finite
 * inputs or when `maxAbs <= 0`. Callers halve this for a centre-split track.
 */
export function cotBarWidth(net: number, maxAbs: number): number {
  if (!Number.isFinite(net) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 0;
  return Math.round((Math.abs(net) / maxAbs) * 100);
}
