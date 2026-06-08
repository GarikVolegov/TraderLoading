import type { NewsArticle, NewsDeepDive } from "./types.js";

export interface NewsDeepDiveContext {
  lang?: string;
}

type Direction = NonNullable<NewsArticle["impactDirection"]>;

function languageOf(lang: string | undefined): "it" | "en" {
  return lang?.toLowerCase().startsWith("en") ? "en" : "it";
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map(clean).filter(Boolean)));
}

function focusLabel(article: NewsArticle, lang: "it" | "en"): string {
  const pairs = unique(article.affectedPairs);
  if (pairs.length > 0) return pairs.join(", ");
  const assets = unique(article.primaryAssets);
  if (assets.length > 0) return assets.join(", ");
  return lang === "it" ? "gli asset collegati" : "the linked assets";
}

function withFocus(reason: string, focus: string, lang: "it" | "en"): string {
  if (!focus || reason.includes(focus)) return reason;
  return lang === "it" ? `${reason} Focus: ${focus}.` : `${reason} Focus: ${focus}.`;
}

function directionOf(article: NewsArticle): Direction {
  if (article.impactDirection === "bullish" || article.sentiment === "bullish") return "bullish";
  if (article.impactDirection === "bearish" || article.sentiment === "bearish") return "bearish";
  if (article.impactDirection === "mixed") return "mixed";
  return "neutral";
}

function possibleImpact(article: NewsArticle, lang: "it" | "en"): string {
  const focus = focusLabel(article, lang);
  const score = article.impactScore ?? 0;
  const direction = directionOf(article);

  if (direction === "bullish") {
    return lang === "it"
      ? `Potrebbe sostenere ${focus} e aumentare la probabilita' di movimenti direzionali se il mercato conferma il driver.`
      : `It could support ${focus} and raise the chance of directional moves if the market confirms the driver.`;
  }

  if (direction === "bearish") {
    return lang === "it"
      ? `Potrebbe aumentare la pressione ribassista su ${focus}, soprattutto se il mercato conferma il driver macro.`
      : `It could add bearish pressure on ${focus}, especially if the market confirms the macro driver.`;
  }

  if (direction === "mixed" || score >= 5) {
    return lang === "it"
      ? `Potrebbe aumentare la volatilita' su ${focus} senza una direzione immediata chiara.`
      : `It could increase volatility in ${focus} without a clear immediate direction.`;
  }

  return lang === "it"
    ? `Impatto probabilmente limitato su ${focus}, ma utile da monitorare se si somma ad altri driver.`
    : `The impact on ${focus} is likely limited, but it is worth monitoring if it combines with other drivers.`;
}

export function buildNewsDeepDive(article: NewsArticle, context: NewsDeepDiveContext = {}): NewsDeepDive {
  const lang = languageOf(context.lang);
  const summary = clean(article.summary);
  const title = clean(article.title);
  const whatHappened = summary && summary.toLowerCase() !== title.toLowerCase() ? summary : title;
  const baseReason = clean(article.relevanceReason) || clean(article.impactReason);
  const whyItMatters = baseReason
    ? withFocus(baseReason, focusLabel(article, lang), lang)
    : lang === "it"
      ? "La notizia puo' incidere sul mercato perche' riguarda driver macro o flussi che possono modificare volatilita' e aspettative sugli asset collegati."
      : "The article can matter because it touches macro drivers or flows that may change volatility and expectations for the linked assets.";

  return {
    whatHappened: whatHappened || (lang === "it" ? "La notizia segnala un aggiornamento di mercato da monitorare." : "The article reports a market update worth monitoring."),
    whyItMatters,
    possibleImpact: possibleImpact(article, lang),
  };
}
