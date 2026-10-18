import { uiText } from "@/contexts/LanguageContext";

/** Off-contract tool endpoints share this additive metadata (see docs/market-data-contract.md). */
export interface MarketDataMetadata {
  status: "available" | "stale" | "unavailable";
  source: string | null;
  fetchedAt: string | null;
  observedAt: string | null;
}

export function MarketDataStatus({ data, stale = false }: { data: MarketDataMetadata; stale?: boolean }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground" role="status">
      {(stale || data.status === "stale") && <p className="text-warning">{uiText("market.stale")}</p>}
      {data.source && <p>{uiText("market.source", { source: data.source })}</p>}
      {data.fetchedAt && <p>{uiText("market.fetched", { time: new Date(data.fetchedAt).toLocaleString() })}</p>}
      <p>{data.observedAt
        ? uiText("market.observed", { time: new Date(data.observedAt).toLocaleString() })
        : uiText("market.unknown_time")}</p>
    </div>
  );
}
