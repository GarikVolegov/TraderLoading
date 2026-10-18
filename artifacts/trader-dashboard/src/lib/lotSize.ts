/** Estimate only: pipValue must already be expressed in the risk currency per lot. */
export function estimateLotSize(riskText: string, stopText: string, pipValue: number): string | null {
  if (!riskText.trim() || !stopText.trim()) return null;
  const risk = Number(riskText), stop = Number(stopText);
  if (![risk, stop, pipValue].every(Number.isFinite) || risk < 0 || stop <= 0 || pipValue <= 0) return null;
  const units = risk / stop / pipValue;
  if (!Number.isFinite(units) || units > Number.MAX_SAFE_INTEGER / 100) return null;
  // Round down so the displayed estimate never increases the configured risk.
  return (Math.floor(units * 100) / 100).toFixed(2);
}
