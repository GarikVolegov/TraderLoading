import { useSearch } from "wouter";
import TradingCockpit from "./TradingCockpit";
import LegacyToday from "./TodayLegacy";

/** Older confirmed sessions and explicit decision links retain their original workflow. */
export default function Today() {
 const query = new URLSearchParams(useSearch());
 return query.get("process") === "legacy" || query.has("marketDecisionId") ? <LegacyToday /> : <TradingCockpit />;
}
