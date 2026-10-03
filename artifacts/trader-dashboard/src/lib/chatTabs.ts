export type ChatTab = "social" | "messaggi" | "comunita" | "classifica";

const CHAT_TABS: readonly ChatTab[] = ["social", "messaggi", "comunita", "classifica"];

/** Reads the active `/chat` tab from a location search string (`?t=…`). */
export function parseChatTab(search: string): ChatTab {
  const value = new URLSearchParams(search).get("t");
  return CHAT_TABS.includes(value as ChatTab) ? (value as ChatTab) : "social";
}
