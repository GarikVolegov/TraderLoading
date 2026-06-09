import type { NewsArticle, NewsDeepDive } from "./types.js";

export interface NewsDeepDiveContext {
  lang?: string;
  /**
   * Feed-level seed (typically the article index) that rotates the phrasing
   * variants so adjacent articles never share the same template sentence.
   */
  variantSeed?: number;
}

type Direction = NonNullable<NewsArticle["impactDirection"]>;
type Lang = "it" | "en";
type Driver = "inflation" | "rates" | "jobs" | "growth" | "geopolitics" | "energy" | "generic";

function languageOf(lang: string | undefined): Lang {
  return lang?.toLowerCase().startsWith("en") ? "en" : "it";
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map(clean).filter(Boolean)));
}

function stableHash(text: string): number {
  let hash = 7;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  return hash;
}

function pick(variants: string[], article: NewsArticle, seed: number): string {
  if (variants.length === 0) return "";
  return variants[(stableHash(article.title) + seed) % variants.length];
}

function focusLabel(article: NewsArticle, lang: Lang): string {
  const pairs = unique(article.affectedPairs);
  if (pairs.length > 0) return pairs.join(", ");
  const assets = unique(article.primaryAssets);
  if (assets.length > 0) return assets.join(", ");
  return lang === "it" ? "gli asset collegati" : "the linked assets";
}

function withFocus(reason: string, focus: string): string {
  if (!focus || reason.includes(focus)) return reason;
  return `${reason} Focus: ${focus}.`;
}

function directionOf(article: NewsArticle): Direction {
  if (article.impactDirection === "bullish" || article.sentiment === "bullish") return "bullish";
  if (article.impactDirection === "bearish" || article.sentiment === "bearish") return "bearish";
  if (article.impactDirection === "mixed") return "mixed";
  return "neutral";
}

function articleText(article: NewsArticle): string {
  return [article.title, article.summary, article.originalTitle, article.originalSummary]
    .filter(Boolean)
    .join(" ");
}

// ─── Driver detection ─────────────────────────────────────────────────────────

const DRIVER_RES: Array<{ driver: Driver; re: RegExp }> = [
  { driver: "inflation", re: /\bcpi\b|\bpce\b|\bppi\b|inflation|inflazione|consumer\s+price|price\s+index/i },
  { driver: "jobs", re: /non.?farm|\bnfp\b|payrolls?|jobs?\s+report|unemployment|occupazion|employment\s+data/i },
  { driver: "rates", re: /\bfed\b|\bfomc\b|powell|\becb\b|lagarde|\bboe\b|\bboj\b|\bsnb\b|\brba\b|\brbnz\b|central\s+bank|banca\s+centrale|rate\s+(decision|hike|cut|change)|interest\s+rates?|minutes|treasury\s+yields?|bond\s+yields?|tassi/i },
  { driver: "growth", re: /\bgdp\b|\bpil\b|\bpmi\b|retail\s+sales|gross\s+domestic|recession|recessione/i },
  { driver: "geopolitics", re: /war|conflict|invasion|sanction|tariff|geopolit|military|guerra|sanzion|dazi/i },
  { driver: "energy", re: /\boil\b|crude|brent|\bwti\b|natural\s+gas|petrolio|energy\s+prices/i },
];

function detectDriver(article: NewsArticle): Driver {
  const text = articleText(article);
  for (const { driver, re } of DRIVER_RES) {
    if (re.test(text)) return driver;
  }
  return "generic";
}

// ─── Concrete figures extraction ──────────────────────────────────────────────

const FIGURE_RES = [
  /[+-]?\d+(?:[.,]\d+)?\s*%/g,
  /\d+(?:[.,]\d+)?\s*(?:bps|basis\s+points?|punti\s+base)/gi,
  /\$\s?\d+(?:[.,]\d+)?\s*(?:k|m|bn|mln|mld|trillion|billion|million|miliardi|milioni)?/gi,
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,
];

export function extractNewsFigures(text: string): string[] {
  const figures: string[] = [];
  for (const re of FIGURE_RES) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = match[0].replace(/\s+/g, " ").trim();
      if (!figures.includes(value)) figures.push(value);
      if (figures.length >= 4) return figures;
    }
  }
  return figures;
}

// ─── whyItMatters: transmission mechanism per driver ──────────────────────────

const MECHANISMS: Record<Lang, Record<Driver, string[]>> = {
  it: {
    inflation: [
      "Il dato inflattivo guida le aspettative sui tassi: una sorpresa sposta rendimenti reali e dollaro, i due canali principali per {focus}.",
      "L'inflazione collega i dati macro alla politica monetaria: cambia il percorso atteso dei tassi e il mercato riprezza {focus} di conseguenza.",
    ],
    rates: [
      "Le indicazioni di banca centrale muovono i differenziali di tasso: è il canale che riprezza {focus} nel breve, prima ancora dei dati macro.",
      "Tassi e rendimenti sono il driver dominante: il mercato riprezza la curva e {focus} segue il differenziale atteso.",
    ],
    jobs: [
      "Il mercato del lavoro USA orienta la Fed: un dato forte sostiene dollaro e rendimenti, uno debole li indebolisce, con effetto diretto su {focus}.",
      "I dati occupazionali cambiano le probabilità di mosse Fed: il riprezzamento dei tassi si trasmette subito a {focus}.",
    ],
    growth: [
      "I dati di crescita cambiano le attese di politica monetaria e l'appetito per il rischio del mercato, condizionando {focus}.",
      "Crescita sopra o sotto le attese sposta sia i tassi attesi sia i flussi risk-on/risk-off rilevanti per {focus}.",
    ],
    geopolitics: [
      "Il rischio geopolitico sposta i flussi verso i beni rifugio e alza la volatilità attesa su {focus}.",
      "Eventi geopolitici muovono premi al rischio e domanda di safe haven: il mercato lo prezza rapidamente su {focus}.",
    ],
    energy: [
      "I prezzi dell'energia incidono sull'inflazione attesa e sulle ragioni di scambio, con ricadute di mercato su {focus}.",
      "Il canale energia→inflazione→tassi rende questi movimenti rilevanti per {focus}.",
    ],
    generic: [],
  },
  en: {
    inflation: [
      "Inflation data drives rate expectations: a surprise moves real yields and the dollar, the two main channels for {focus}.",
      "Inflation links macro data to monetary policy: it changes the expected rate path and the market reprices {focus} accordingly.",
    ],
    rates: [
      "Central bank signals move rate differentials: that is the channel repricing {focus} in the short term, ahead of macro data.",
      "Rates and yields are the dominant driver: the market reprices the curve and {focus} follows the expected differential.",
    ],
    jobs: [
      "The US labor market steers the Fed: a strong print supports the dollar and yields, a weak one softens them, with direct effect on {focus}.",
      "Employment data shifts the odds of Fed moves: the rate repricing transmits immediately to {focus}.",
    ],
    growth: [
      "Growth data changes monetary policy expectations and the market's risk appetite, conditioning {focus}.",
      "Growth above or below expectations moves both expected rates and risk-on/risk-off flows relevant for {focus}.",
    ],
    geopolitics: [
      "Geopolitical risk shifts flows toward safe havens and raises expected volatility in {focus}.",
      "Geopolitical events move risk premia and safe-haven demand: the market prices it quickly into {focus}.",
    ],
    energy: [
      "Energy prices feed expected inflation and terms of trade, with market spillovers into {focus}.",
      "The energy→inflation→rates channel makes these moves relevant for {focus}.",
    ],
    generic: [],
  },
};

// Two-sided scenario framing for data-release drivers (the non-trivial part a
// trader actually wants: what happens above vs below expectations). Split into
// sides so the clause that agrees with the article's direction can lead.
const SCENARIO_SIDES: Record<Lang, Partial<Record<Driver, { up: string; down: string }>>> = {
  it: {
    inflation: {
      up: "sopra le attese favorisce dollaro e rendimenti (pressione sull'oro e sugli asset sensibili ai tassi)",
      down: "sotto le attese indebolisce dollaro e rendimenti e sostiene i beni rifugio",
    },
    jobs: {
      up: "un dato sopra le attese rafforza dollaro e rendimenti",
      down: "sotto le attese aumenta le probabilità di una Fed più accomodante",
    },
    rates: {
      up: "toni hawkish sostengono la valuta di riferimento",
      down: "toni dovish la indeboliscono e sostengono gli asset rifugio",
    },
  },
  en: {
    inflation: {
      up: "above expectations favors the dollar and yields (pressure on gold and rate-sensitive assets)",
      down: "below expectations softens them and supports safe havens",
    },
    jobs: {
      up: "a beat strengthens the dollar and yields",
      down: "a miss raises the odds of a more dovish Fed",
    },
    rates: {
      up: "hawkish tones support the reference currency",
      down: "dovish tones weaken it and support safe havens",
    },
  },
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function scenarioHint(lang: Lang, driver: Driver, direction: Direction): string | undefined {
  const sides = SCENARIO_SIDES[lang][driver];
  if (!sides) return undefined;
  // Lead with the side consistent with the article's call so the hint reads as
  // an extension of the scenario, not a contradiction.
  const ordered = direction === "bullish" ? [sides.down, sides.up] : [sides.up, sides.down];
  return `${capitalize(ordered[0])}; ${ordered[1]}.`;
}

// ─── possibleImpact variants ──────────────────────────────────────────────────

function magnitudeLabel(score: number, lang: Lang): string {
  if (score >= 8) return lang === "it" ? "impatto potenzialmente elevato" : "potentially high impact";
  if (score >= 5) return lang === "it" ? "impatto moderato" : "moderate impact";
  return lang === "it" ? "impatto contenuto" : "contained impact";
}

const IMPACT_VARIANTS: Record<Lang, Record<"bullish" | "bearish" | "volatile" | "limited", string[]>> = {
  it: {
    bullish: [
      "Potrebbe sostenere {focus} ({magnitude}): la conferma arriva se il mercato consolida il movimento dopo la notizia.",
      "Bias rialzista su {focus}: il driver può sostenere il prezzo ({magnitude}), ma conta quanto era già prezzato dal mercato.",
    ],
    bearish: [
      "Potrebbe aumentare la pressione ribassista su {focus} ({magnitude}); il segnale va confermato dalla reazione di dollaro e rendimenti.",
      "Scenario ribassista per {focus} ({magnitude}): valido finché i prezzi confermano il driver, invalidato da un rientro rapido della notizia.",
    ],
    volatile: [
      "Potrebbe aumentare la volatilità su {focus} senza una direzione immediata chiara: il posizionamento conta più del titolo.",
      "Atteso aumento di volatilità su {focus}: meglio attendere la reazione iniziale del mercato prima di prendere posizione.",
    ],
    limited: [
      "Impatto probabilmente limitato su {focus}, ma utile da monitorare se si somma ad altri driver nella stessa direzione.",
      "Da solo ha un impatto limitato su {focus}: diventa rilevante solo se confermato da altri driver da monitorare.",
    ],
  },
  en: {
    bullish: [
      "It could support {focus} ({magnitude}): confirmation comes if the market consolidates the move after the news.",
      "Bullish bias on {focus}: the driver could support price ({magnitude}), but how much was already priced in matters.",
    ],
    bearish: [
      "It could add bearish pressure on {focus} ({magnitude}); the signal needs confirmation from the dollar and yields reaction.",
      "Bearish scenario for {focus} ({magnitude}): downside pressure holds while price action confirms the driver.",
    ],
    volatile: [
      "It could increase volatility in {focus} without a clear immediate direction: positioning matters more than the headline.",
      "Expect higher volatility in {focus}: better to wait for the market's initial reaction before taking a position.",
    ],
    limited: [
      "The impact on {focus} is likely limited, but it is worth monitoring if it combines with other drivers.",
      "On its own the impact on {focus} is limited: it only becomes relevant if other drivers worth monitoring confirm it.",
    ],
  },
};

function fill(template: string, focus: string, magnitude: string): string {
  return template.replace(/\{focus\}/g, focus).replace(/\{magnitude\}/g, magnitude);
}

function possibleImpact(article: NewsArticle, lang: Lang, driver: Driver, seed: number): string {
  const focus = focusLabel(article, lang);
  const score = article.impactScore ?? 0;
  const direction = directionOf(article);
  const magnitude = magnitudeLabel(score, lang);

  let kind: "bullish" | "bearish" | "volatile" | "limited";
  if (direction === "bullish") kind = "bullish";
  else if (direction === "bearish") kind = "bearish";
  else if (direction === "mixed" || score >= 5) kind = "volatile";
  else kind = "limited";

  let text = fill(pick(IMPACT_VARIANTS[lang][kind], article, seed), focus, magnitude);

  // Add the two-sided scenario only when the article is impactful enough that
  // the above/below-expectations framing is actionable.
  const hint = score >= 5 ? scenarioHint(lang, driver, direction) : undefined;
  if (hint) text = `${text} ${hint}`;
  return text;
}

// ─── whatHappened enrichment ──────────────────────────────────────────────────

function recencyLabel(article: NewsArticle, lang: Lang): string {
  if (!article.publishedAt) return "";
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return "";
  const hours = Math.round(ageMs / (60 * 60 * 1000));
  if (hours < 1) return lang === "it" ? "pubblicata da meno di un'ora" : "published less than an hour ago";
  if (hours < 48) {
    return lang === "it" ? `pubblicata circa ${hours} ${hours === 1 ? "ora" : "ore"} fa` : `published about ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  return lang === "it" ? `pubblicata circa ${days} giorni fa` : `published about ${days} days ago`;
}

function whatHappened(article: NewsArticle, lang: Lang): string {
  const summary = clean(article.summary);
  const title = clean(article.title);
  const isBanal = !summary || summary.toLowerCase() === title.toLowerCase();
  let base = isBanal ? title : summary;

  if (!base) {
    return lang === "it"
      ? "La notizia segnala un aggiornamento di mercato da monitorare."
      : "The article reports a market update worth monitoring.";
  }

  // Surface only figures that the visible text does not already contain
  // (typically numbers living in the original/untranslated headline).
  const figures = extractNewsFigures(articleText(article)).filter((figure) => !base.includes(figure));
  if (figures.length > 0) {
    base += lang === "it" ? ` Dati chiave: ${figures.join(", ")}.` : ` Key figures: ${figures.join(", ")}.`;
  }

  // When the summary adds nothing over the title, ground the entry with source
  // and recency so the card still carries concrete information.
  if (isBanal && article.source) {
    const recency = recencyLabel(article, lang);
    base += lang === "it"
      ? ` Fonte: ${article.source}${recency ? `, ${recency}` : ""}.`
      : ` Source: ${article.source}${recency ? `, ${recency}` : ""}.`;
  }

  return base;
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildNewsDeepDive(article: NewsArticle, context: NewsDeepDiveContext = {}): NewsDeepDive {
  const lang = languageOf(context.lang);
  const seed = context.variantSeed ?? 0;
  const driver = detectDriver(article);
  const focus = focusLabel(article, lang);

  const baseReason = clean(article.relevanceReason) || clean(article.impactReason);
  const fallbackReason = lang === "it"
    ? "La notizia può incidere sul mercato perché riguarda driver macro o flussi che possono modificare volatilità e aspettative sugli asset collegati."
    : "The article can matter because it touches macro drivers or flows that may change volatility and expectations for the linked assets.";
  const mechanism = fill(pick(MECHANISMS[lang][driver], article, seed), focus, "");
  const whyItMatters = withFocus(
    [baseReason || fallbackReason, mechanism].filter(Boolean).join(" "),
    focus,
  );

  return {
    whatHappened: whatHappened(article, lang),
    whyItMatters,
    possibleImpact: possibleImpact(article, lang, driver, seed),
  };
}
