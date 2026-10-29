/** Preserve unrelated context when switching a workspace view. */
export function updateWorkspaceQuery(
  search: string,
  updates: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

/** Only legacy checkout returns may resolve a channel without a community. */
export function legacyCheckoutChannel(search: string): number | null {
  const params = new URLSearchParams(search);
  if (
    params.has("community") ||
    params.has("peer") ||
    ![null, "conversazioni"].includes(params.get("t")) ||
    !["success", "cancel"].includes(params.get("unlock") ?? "")
  )
    return null;
  const raw = params.get("channel");
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function resolveWorkspaceAlias(path: string, search = ""): string | null {
  if (path === "/" && legacyCheckoutChannel(search)) {
    return `/chat${updateWorkspaceQuery(search, { t: "conversazioni", vista: null })}`;
  }
  if (path === "/" && new URLSearchParams(search).get("vista") === "mercati") {
    return `/${updateWorkspaceQuery(search, { vista: null })}`;
  }
  const aliases: Record<string, [string, Record<string, string>]> = {
    "/news": ["/", { vista: "notizie" }],
    "/dashboard/widgets": ["/", { vista: "strumenti" }],
    "/library": ["/wiki", { t: "unlocked" }],
    "/tornei": [
      "/chat",
      {
        t: "competizioni",
        vista: new URLSearchParams(search).get("sub") === "backtest" ? "battaglie" : "torneo",
      },
    ],
    "/calendar": ["/journal", { t: "piano", vista: "agenda" }],
    "/resources": ["/", {}],
    "/clock": ["/", { vista: "strumenti", strumento: "sessioni" }],
    "/method": ["/", {}],
    "/checklist": ["/", {}],
    "/broker": ["/journal", { t: "trades", panel: "conti" }],
    "/tools": ["/backtest", {}],
  };
  const alias = aliases[path];
  return alias ? `${alias[0]}${updateWorkspaceQuery(search, alias[1])}` : null;
}

/** Explicit legacy workspaces take precedence over the new daily entry point. */
export function hasExplicitCenterView(search: string): boolean {
  const params = new URLSearchParams(search);
  return (
    ["notizie", "strumenti"].includes(params.get("vista") ?? "") ||
    params.get("layout") === "edit" ||
    params.has("article") ||
    ["strumento", "widget"].some((key) => params.has(key))
  );
}

export function centerView(search: string): "mercati" | "notizie" | "strumenti" {
  const params = new URLSearchParams(search);
  if (params.get("layout") === "edit") return "strumenti";
  const requested =
    params.get("vista") ??
    (params.has("article")
      ? "notizie"
      : params.has("strumento") || params.has("widget")
        ? "strumenti"
        : null);
  return requested === "notizie" || requested === "strumenti" ? requested : "mercati";
}
