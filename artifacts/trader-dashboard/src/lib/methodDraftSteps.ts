export type MethodDraftValues = Record<string, string | boolean>;
export function methodDraftStep(values: MethodDraftValues, requested: number): 0 | 1 | 2 {
  if (
    ![
      "markets",
      "windows",
      "setup",
      "entry",
      "exit",
      "invalidation",
      "waitConditions",
    ].every((key) => String(values[key] ?? "").trim())
  )
    return 0;
  if (requested < 2) return requested === 1 ? 1 : 0;
  const positive = (key: string) => Number.isFinite(Number(values[key])) && Number(values[key]) > 0;
  if (
    !/^[A-Z]{3}$/.test(String(values.currency ?? "")) ||
    !positive("riskPerTrade") ||
    !positive("maxDailyLoss") ||
    !positive("maxDailyTrades") ||
    !Number.isInteger(Number(values.maxDailyTrades)) ||
    !String(values.checklist ?? "")
      .split("\n")
      .some((line) => line.trim())
  )
    return 1;
  return 2;
}
