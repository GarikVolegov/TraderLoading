/** One catalogue for Resources, commands and legacy widget destinations. */
export type ToolGroup = "context" | "verification" | "materials" | "support";
export const TOOL_GROUPS: ToolGroup[] = ["context", "verification", "materials", "support"];
export const WORKSPACE_TOOLS = [
  { id: "academy", group: "materials", href: "/academy", labelKey: "academy.title", keywords: "academy formazione video lezioni docente scalp swing affiliazione" },
  {
    id: "markets",
    group: "context",
    href: "/?vista=mercati",
    labelKey: "workspace.markets",
    keywords: "mercati markets pair contesto outlook macro",
  },
  {
    id: "news",
    group: "context",
    href: "/?vista=notizie",
    labelKey: "workspace.news",
    keywords: "news notizie eventi macro articoli",
  },
  {
    id: "watchlist",
    group: "context",
    href: "/?vista=strumenti&widget=tradingview-watchlist",
    labelKey: "auto.ui.b97144823c",
    widgetId: "tradingview-watchlist",
    keywords: "watchlist tradingview quotazioni prezzi pairs",
  },
  {
    id: "economic-calendar",
    group: "context",
    href: "/?vista=strumenti&widget=calendar",
    labelKey: "catalog.economic_calendar",
    widgetId: "calendar",
    keywords: "calendario economico calendar macro eventi impact",
  },
  {
    id: "sessions",
    group: "context",
    href: "/?vista=strumenti&strumento=sessioni",
    labelKey: "workspace.sessions",
    keywords: "clock sessioni mercato orari london new york tokyo",
  },
  {
    id: "calculator",
    group: "context",
    href: "/?vista=strumenti&strumento=calcolatore",
    labelKey: "lot_calculator.title",
    widgetId: "lot",
    keywords: "calculator calcolatore rischio lotti dimensionamento risk",
  },
  {
    id: "sentiment",
    group: "context",
    href: "/?vista=strumenti&widget=sentiment",
    labelKey: "auto.ui.dc850cabd8",
    widgetId: "sentiment",
    keywords: "sentiment posizionamento long short",
  },
  {
    id: "volatility",
    group: "context",
    href: "/?vista=strumenti&widget=volatility",
    labelKey: "auto.ui.92ef7e46bf",
    widgetId: "volatility",
    keywords: "volatility volatilita range atr",
  },
  {
    id: "cot",
    group: "context",
    href: "/?vista=strumenti&widget=cot",
    labelKey: "cot.report_title",
    widgetId: "cot",
    keywords: "cot cftc commitment traders posizionamento",
  },
  {
    id: "backtest",
    group: "verification",
    href: "/backtest",
    labelKey: "nav.backtest",
    keywords: "backtest replay test verifica storico simulazione strategia",
  },
  {
    id: "checklist",
    group: "verification",
    href: "/method?section=checklist",
    labelKey: "checklist.title",
    widgetId: "checklist",
    keywords: "metodo checklist criteri conferme regole protocollo",
  },
  {
    id: "journal",
    group: "materials",
    href: "/journal?t=trades",
    labelKey: "nav.journal",
    widgetId: "journal",
    keywords: "journal diario trade registro import csv fuori piano",
  },
  {
    id: "reviews",
    group: "materials",
    href: "/journal?t=revisione",
    labelKey: "journal.tab.revisione",
    keywords:
      "review revisione recap settimanale 28 giorni decisioni risultati aderenza miglioramento",
  },
  {
    id: "accounts",
    group: "materials",
    href: "/journal?t=trades&panel=conti",
    labelKey: "page.broker.title",
    widgetId: "account",
    keywords: "account conto broker sincronizzazione fx blue equity curve",
  },
  {
    id: "archive",
    group: "materials",
    href: "/wiki",
    labelKey: "nav.wiki",
    keywords: "archivio wiki note appunti documenti mappe cartelle tag video",
  },
  {
    id: "unlocked",
    group: "materials",
    href: "/wiki?t=unlocked",
    labelKey: "nav.library",
    keywords: "contenuti materiali formativi library sbloccati",
  },
  {
    id: "agenda",
    group: "materials",
    href: "/journal?t=piano&vista=agenda",
    labelKey: "journal.workspace.agenda",
    keywords: "agenda planner appuntamenti eventi ics impegni",
  },
  {
    id: "ideas",
    group: "materials",
    href: "/journal?t=piano&vista=idee-obiettivi",
    labelKey: "journal.workspace.ideas_goals",
    keywords: "idee ideas obiettivi goals scadenze",
  },
  {
    id: "widgets",
    group: "materials",
    href: "/?vista=strumenti",
    labelKey: "catalog.widgets",
    keywords: "widgets griglia personalizzata strumenti disposizione layout",
  },
  {
    id: "wellbeing",
    group: "support",
    href: "/routine",
    labelKey: "process.resources.wellbeing",
    widgetId: "routine",
    keywords: "routine benessere breathing respirazione meditazione gratitudine concentrazione",
  },
  {
    id: "missions",
    group: "support",
    href: "/missions",
    labelKey: "missions.title",
    widgetId: "missions",
    keywords: "missioni missions xp",
  },
  {
    id: "community",
    group: "support",
    href: "/chat",
    labelKey: "workspace.social",
    keywords: "social community chat messaggi conversazioni canali voce",
  },
  {
    id: "competitions",
    group: "support",
    href: "/chat?t=competizioni&vista=torneo",
    labelKey: "tornei.nav",
    keywords: "torneo tornei competizioni classifica leaderboard nft",
  },
  {
    id: "rewards",
    group: "support",
    href: "/milestones",
    labelKey: "process.resources.rewards",
    keywords: "xp livelli premi certificati milestones",
  },
  {
    id: "quotes",
    group: "support",
    href: "/?vista=strumenti&widget=quote",
    labelKey: "auto.ui.070b588c21",
    widgetId: "quote",
    keywords: "quote citazioni motivazione frasi",
  },
  {
    id: "support",
    group: "support",
    href: "/support",
    labelKey: "catalog.support",
    keywords: "supporto help assistenza ticket",
  },
  {
    id: "settings",
    group: "support",
    href: "/settings",
    labelKey: "nav.settings",
    keywords: "impostazioni settings profilo aspetto audio notifiche sicurezza pair",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  group: ToolGroup;
  href: string;
  labelKey: string;
  widgetId?: string;
  keywords: string;
}>;
export type WorkspaceTool = (typeof WORKSPACE_TOOLS)[number];
/** Preparation is visible before the optional catalog; destinations stay canonical. */
export const PREPARATION_STEPS = [
  { id: "market", tools: ["markets", "news"] },
  { id: "timing", tools: ["economic-calendar", "sessions"] },
  { id: "risk", tools: ["calculator"] },
] as const;
export const PREPARATION_TOOLS = PREPARATION_STEPS.flatMap((step) =>
  step.tools.map((id) => WORKSPACE_TOOLS.find((tool) => tool.id === id)!),
);
export function widgetDestination(id: string): string | undefined {
  return WORKSPACE_TOOLS.find((tool) => "widgetId" in tool && tool.widgetId === id)?.href;
}
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchingTools(query: string, translate: (key: string) => string): WorkspaceTool[] {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return WORKSPACE_TOOLS.filter((tool) => {
    const text = searchable(
      `${translate(tool.labelKey)} ${translate(`catalog.hint.${tool.id}`)} ${tool.keywords}`,
    );
    return terms.every((term) => text.includes(term));
  });
}
