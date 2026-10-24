/** TraderLoading cockpit protocol adapted from the user's reference, version 32.
 * All chart confirmations are declared observations, never inferred price signals. */
export const COCKPIT_VERSION = "2026-10-14-r3" as const;
export interface CockpitAnalysis {
  version: typeof COCKPIT_VERSION;
  day: string;
  mode: "scalp" | "swing";
  market: string;
  phase: 1 | 2 | 3;
  cycle: "" | "up" | "down" | "end_up" | "end_down";
  context: "" | "compression" | "swept" | "intermediate";
  scenario: "" | "valid_zone" | "no_zone" | "reaccum";
  itfSchema: boolean;
  ltfSchema: boolean;
  trigger: "" | "TEST" | "POC" | "JTC" | "BTI";
  area: "" | "history" | "virgin";
  imbalance: boolean;
  target: string;
  targetConfirmed: boolean;
  execTF: "M1" | "M5";
  asiaConfirmed: boolean;
  impulseStarted: boolean;
  news: "unchecked" | "clear" | "pre" | "post";
  newsDay: string;
  notes: string;
}
export const MARKETS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "SPX500", "BTCUSD", "ETHUSD"] as const;
export const cockpitDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function freshCockpit(
  market = "XAUUSD",
  mode: CockpitAnalysis["mode"] = "scalp",
  date = new Date(),
): CockpitAnalysis {
  return {
    version: COCKPIT_VERSION,
    day: cockpitDay(date),
    market,
    mode,
    phase: 1,
    cycle: "",
    context: "",
    scenario: "",
    itfSchema: false,
    ltfSchema: false,
    trigger: "",
    area: "",
    imbalance: false,
    target: "",
    targetConfirmed: false,
    execTF: "M1",
    asiaConfirmed: false,
    impulseStarted: false,
    news: "unchecked",
    newsDay: "",
    notes: "",
  };
}
export function cockpitScenarios(s: CockpitAnalysis) {
  return s.context === "intermediate" ? ["reaccum"] : ["valid_zone", "no_zone", "reaccum"];
}
export function cockpitTriggers(s: CockpitAnalysis) {
  return s.scenario === "reaccum"
    ? ["JTC"]
    : s.scenario === "no_zone"
      ? ["JTC", "BTI"]
      : ["TEST", "POC", "JTC", "BTI"];
}
export const cockpitContextReady = (s: CockpitAnalysis) =>
  Boolean(s.cycle && ["swept", "intermediate"].includes(s.context));
export function changeCockpit(
  s: CockpitAnalysis,
  patch: Partial<CockpitAnalysis>,
): CockpitAnalysis {
  let next = { ...s, ...patch };
  if (
    (patch.market !== undefined && patch.market !== s.market) ||
    (patch.mode !== undefined && patch.mode !== s.mode)
  )
    return { ...freshCockpit(next.market, next.mode), notes: s.notes };
  if (patch.cycle !== undefined && patch.cycle !== s.cycle)
    next = {
      ...freshCockpit(s.market, s.mode),
      cycle: patch.cycle,
      notes: s.notes,
      news: s.news,
      newsDay: s.newsDay,
    };
  if (patch.context !== undefined && patch.context !== s.context)
    next = {
      ...freshCockpit(s.market, s.mode),
      cycle: s.cycle,
      context: patch.context,
      notes: s.notes,
      news: s.news,
      newsDay: s.newsDay,
    };
  if (patch.scenario !== undefined && patch.scenario !== s.scenario)
    next = {
      ...next,
      itfSchema: false,
      ltfSchema: false,
      trigger: "",
      area: "",
      imbalance: false,
      target: "",
      targetConfirmed: false,
      phase: 3,
    };
  if (patch.itfSchema === false)
    next = { ...next, ltfSchema: false, trigger: "", targetConfirmed: false };
  if (patch.ltfSchema === false || (patch.execTF && patch.execTF !== s.execTF)) next.trigger = "";
  if (patch.execTF && patch.execTF !== s.execTF) next.ltfSchema = false;
  if (patch.news && ["pre", "post"].includes(patch.news) && patch.news !== s.news)
    next = { ...next, itfSchema: false, ltfSchema: false, trigger: "", targetConfirmed: false };
  return next;
}
export function cockpitWindow(s: Pick<CockpitAnalysis, "mode" | "market">, date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  }).format(date);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const m =
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value);
  if (["BTCUSD", "ETHUSD"].includes(s.market))
    return { name: "Crypto 24/7", kind: "open", hours: "Mercato sempre attivo 24/7" };
  if (["Sat", "Sun"].includes(weekday))
    return { name: "Weekend", kind: "closed", hours: "Preparazione della prossima settimana" };
  if (m < 480)
    return {
      name: "Asia",
      kind: m >= 60 && m < 210 ? "asia" : "analysis",
      hours: "00:00–08:00 · ingressi 01:00–03:30",
    };
  if (m < 690) return { name: "Londra", kind: "open", hours: "08:00–11:30" };
  if (m < 810) return { name: "Lunch", kind: "lunch", hours: "11:30–13:30" };
  if (m < 840) return { name: "Intervallo", kind: "analysis", hours: "13:30–14:00" };
  if (m < (s.mode === "scalp" ? 1080 : 1320))
    return {
      name: m >= 1110 ? "Swing / sera" : "New York",
      kind: "open",
      hours: s.mode === "scalp" ? "14:00–18:00" : "14:00–22:00",
    };
  return {
    name: "Chiusura",
    kind: "closed",
    hours: s.mode === "scalp" ? "Dalle 18:00" : "Dalle 22:00",
  };
}
export function cockpitRequirements(s: CockpitAnalysis, date = new Date()): string[] {
  const missing: string[] = [];
  if (s.version !== COCKPIT_VERSION || s.day !== cockpitDay(date))
    missing.push("Rivalida il contesto nella giornata italiana corrente.");
  if (!cockpitContextReady(s))
    missing.push(
      s.context === "compression"
        ? "Compressione: nessun nuovo ingresso."
        : "Posiziona il ciclo HTF e verifica sweep o re-accumuli.",
    );
  if (!s.scenario || !cockpitScenarios(s).includes(s.scenario))
    missing.push("Scegli la zona a sinistra coerente con il contesto.");
  if (!s.itfSchema || !s.ltfSchema)
    missing.push("Conferma la chiusura del ciclo ITF e la schematica LTF.");
  if (!s.trigger || !cockpitTriggers(s).includes(s.trigger))
    missing.push("Scegli un trigger consentito dallo scenario.");
  const area = s.area || "history";
  if (area === "virgin" && !s.imbalance)
    missing.push("Verifica lo storico a sinistra e, in area vergine, lo sbilanciamento manuale.");
  if (!s.target || !s.target.trim())
    missing.push("Identifica il pool di liquidità opposto.");
  const newsVal = s.news === "unchecked" ? "clear" : s.news;
  if (!["clear", "post"].includes(newsVal) || (s.newsDay && s.newsDay !== cockpitDay(date)))
    missing.push(
      "Rivedi il calendario: pre-news e controlli non aggiornati bloccano il piano di ingresso.",
    );
  const win = cockpitWindow(s, date);
  if (win.kind === "closed")
    missing.push("Finestra di mercato chiusa: prepara lo scenario per la sessione successiva.");
  if (win.kind === "analysis" && !s.impulseStarted)
    missing.push("Finestra di analisi: prepara lo scenario, senza nuovi ingressi.");
  if (win.kind === "asia" && !s.asiaConfirmed)
    missing.push("Asia: conferma le condizioni aggiuntive.");
  if (win.kind === "lunch" && !s.impulseStarted)
    missing.push("Lunch: nuovi ingressi solo con impulso già partito.");
  return missing;
}
