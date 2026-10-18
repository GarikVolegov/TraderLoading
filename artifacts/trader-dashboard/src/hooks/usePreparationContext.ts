import { useSearch } from "wouter";
import { useTraderProcess } from "./useTraderProcess";

/** Explicit tool context wins; otherwise reuse the documented daily plan. */
export function usePreparationContext() {
  const params = new URLSearchParams(useSearch());
  const { data } = useTraderProcess();
  const rules = data?.session?.rulesSnapshot ?? data?.activeMethod?.rules;
  return {
    pair:
      params.get("pair") ??
      data?.session?.plan?.market ??
      (rules?.markets.length === 1 ? rules.markets[0] : undefined),
    methodVersionId:
      params.get("methodVersionId") ?? data?.session?.methodVersionId ?? data?.activeMethod?.id,
    fromProcess: true,
  };
}
