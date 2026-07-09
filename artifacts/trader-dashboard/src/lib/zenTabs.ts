export type ZenTab =
  | "breathing"
  | "visualization"
  | "quotes"
  | "gratitude"
  | "meditation"
  | "insight";

const ZEN_TABS: readonly ZenTab[] = [
  "breathing",
  "visualization",
  "quotes",
  "gratitude",
  "meditation",
  "insight",
];

/** Reads the active `/zen` tab from a location search string (`?t=…`). */
export function parseZenTab(search: string): ZenTab {
  const value = new URLSearchParams(search).get("t");
  return ZEN_TABS.includes(value as ZenTab) ? (value as ZenTab) : "breathing";
}
