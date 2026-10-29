import { lazy, Suspense } from "react";
import { useSearch } from "wouter";
import TradingCockpit from "./TradingCockpit";

const LegacyToday = lazy(() => import("./TodayLegacy"));

/** Older confirmed sessions and explicit decision links retain their original workflow. */
export default function Today() {
  const query = new URLSearchParams(useSearch());
  const isLegacy = query.get("process") === "legacy" || query.has("marketDecisionId");
  return isLegacy ? (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <LegacyToday />
    </Suspense>
  ) : (
    <TradingCockpit />
  );
}

