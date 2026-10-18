export type ChatTab = "conversazioni" | "social" | "competizioni";
export type ConversationFilter = "all" | "private" | "community";
export type CompetitionView = "xp" | "torneo" | "percorso";

/** Legacy tab links remain readable while new navigation uses three spaces. */
export function parseChatTab(search: string): ChatTab {
  const value = new URLSearchParams(search).get("t");
  if (value === "social") return "social";
  if (value === "competizioni" || value === "classifica") return "competizioni";
  return "conversazioni";
}

function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function parseSocialLocation(search: string) {
  const params = new URLSearchParams(search);
  const tab = parseChatTab(search);
  const peerId = tab === "conversazioni" ? params.get("peer")?.trim() || null : null;
  const communityId = tab === "conversazioni" && !peerId ? positiveId(params.get("community")) : null;
  const channelId = communityId ? positiveId(params.get("channel")) : null;
  const rawFilter = params.get("filter");
  const filter: ConversationFilter = peerId || params.get("t") === "messaggi" ? "private"
    : communityId || params.get("t") === "comunita" ? "community"
    : rawFilter === "private" || rawFilter === "community" ? rawFilter : "all";
  const rawView = params.get("vista");
  const competitionView: CompetitionView = params.get("t") === "classifica" ? "xp"
    : rawView === "xp" || rawView === "percorso" ? rawView : "torneo";
  return {
    tab, peerId, communityId, channelId, filter, competitionView,
    metric: params.get("metrica") === "ts" ? "ts" as const : "r" as const,
    unlock: params.get("unlock") === "success" ? "success" as const
      : params.get("unlock") === "cancel" ? "cancel" as const : null,
  };
}

export function socialHref(tab: ChatTab, params: Record<string, string | number | null | undefined> = {}): string {
  const query = new URLSearchParams({ t: tab });
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") query.set(key, String(value));
  }
  return `/chat?${query}`;
}
