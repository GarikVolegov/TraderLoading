import { createHash } from "node:crypto";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import type { NewsArticle } from "./types.js";

export type MacroRelease = {
  eventType: string; country: string; referencePeriod: string | null; releaseAt: string | null;
  actual: number | null; previous: number | null; consensus: number | null; revisedPrevious: number | null;
  unit: string | null; consensusAsOf: string | null; sourceUrl: string;
};
export type NewsPairEffect = { pair: string; horizonHours: 4; direction: "bullish" | "bearish" | "uncertain";
  fact: string; scenario: string; invalidation: string; evidenceUrls: string[] };
export const evidenceId = (value: string) => createHash("sha256").update(value).digest("hex");
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_PATTERN = MONTH_NAMES.join("|");

/** Only an adjacent comparison of the same CPI-U MoM series. A YoY number,
 * separate revision paragraph, or nonpreceding month cannot supply previous.
 */
function documentedCpiPrevious(text: string, actualMatch: RegExpExecArray, referencePeriod: string | null): number | null {
  const tail = text.slice(actualMatch.index + actualMatch[0].length);
  const prior = new RegExp(`^\\s*,?\\s*after\\s+(rising|increasing|falling|declining|decreasing)\\s+(\\d+(?:\\.\\d+)?)\\s+percent\\s+in\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`, "i").exec(tail);
  if (!prior) return null;
  const actualMonth = MONTH_NAMES.findIndex(month => month.toLowerCase() === actualMatch[2].toLowerCase());
  const priorMonth = MONTH_NAMES.findIndex(month => month.toLowerCase() === prior[3].toLowerCase());
  if (actualMonth < 0 || priorMonth !== (actualMonth + 11) % 12) return null;
  const reference = referencePeriod && new RegExp(`^(${MONTH_PATTERN})\\s+(20\\d{2})$`, "i").exec(referencePeriod);
  if (reference && reference[1].toLowerCase() !== actualMatch[2].toLowerCase()) return null;
  const actualYear = reference ? Number(reference[2]) : actualMatch[3] ? Number(actualMatch[3]) : null;
  if (reference && actualMatch[3] && Number(actualMatch[3]) !== Number(reference[2])) return null;
  if (prior[4] && (actualYear === null || Number(prior[4]) !== actualYear - (actualMonth === 0 ? 1 : 0))) return null;
  // Revision figures need their own original/revised attribution. Do not guess
  // which value belongs in previous or replace the current actual with one.
  const sameSentence = tail.slice(prior[0].length).split(/\.(?:\s|$)/)[0];
  if (/\b(revised|revision|corrected|correction)\b/i.test(sameSentence)) return null;
  const value = Number(prior[2]) * (/falling|declining|decreasing/i.test(prior[1]) ? -1 : 1);
  return Number.isFinite(value) ? value : null;
}

export function canonicalNewsUrl(raw: string | null | undefined): string | null {
  try {
    const url = new URL(raw ?? "");
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}

/** Parses only explicit named series. Missing consensus/previous never become zero. */
export function documentedRelease(article: NewsArticle, text: string): MacroRelease | undefined {
  const url = canonicalNewsUrl(article.resolvedUrl ?? article.url);
  if (!url || article.sourceType !== "official") return undefined;
  const host = new URL(url).hostname;
  const referencePeriod = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b|\b(?:first|second|third|fourth) quarter(?: of)?\s+20\d{2}\b/i.exec(article.originalTitle ?? article.title)?.[0] ?? null;
  let eventType: string | undefined, actual: number | null = null, previous: number | null = null, unit: string | null = null;
  if (host === "www.bls.gov" && /\/cpi\./i.test(url)) {
    eventType = "cpi_mom";
    const m = new RegExp(`Consumer Price Index for All Urban Consumers[^.]{0,180}?(?:rose|increased|fell|declined)\\s+(\\d+(?:\\.\\d+)?)\\s+percent\\s+in\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\s+on a seasonally adjusted basis`, "i").exec(text);
    if (m) {
      actual = Number(m[1]) * (/fell|declined/i.test(m[0]) ? -1 : 1); unit = "percent_mom_seasonally_adjusted";
      previous = documentedCpiPrevious(text, m, referencePeriod);
    }
  } else if (host === "www.bls.gov" && /\/empsit\./i.test(url)) {
    eventType = "nonfarm_payrolls";
    const m = /(?:total\s+)?nonfarm payroll employment[^.]{0,90}?(?:increased|rose|declined|decreased)[^\d]{0,25}([\d,]+)/i.exec(text);
    if (m) { actual = Number(m[1].replace(/,/g, "")) * (/declined|decreased/i.test(m[0]) ? -1 : 1); unit = "jobs_change"; }
  } else if (host === "www.bea.gov" && /gross.domestic.product/i.test(`${url} ${article.title}`)) {
    eventType = "gdp";
    const m = /real gross domestic product(?:\s*\(GDP\))?\s+(?:increased|decreased)\s+at an annual rate of\s+(\d+(?:\.\d+)?)\s+percent/i.exec(text);
    if (m) { actual = Number(m[1]) * (/decreased/i.test(m[0]) ? -1 : 1); unit = "percent_annualized"; }
  } else if (/fed|reserve|ecb|england|japan|snb|canada|rba|rbnz/i.test(article.source) && /rates?|monetary policy|fomc/i.test(article.title)) eventType = "monetary_policy";
  if (!eventType) return undefined;
  const country = /ecb/i.test(article.source) ? "EUR" : /england/i.test(article.source) ? "GBP" : /japan/i.test(article.source) ? "JPY" : /snb|swiss/i.test(article.source) ? "CHF" : /canada/i.test(article.source) ? "CAD" : /rbnz|zealand/i.test(article.source) ? "NZD" : /rba|australia/i.test(article.source) ? "AUD" : "USD";
  return { eventType, country, referencePeriod, releaseAt: article.publishedAt, actual: Number.isFinite(actual) ? actual : null,
    previous, revisedPrevious: null, consensus: null, consensusAsOf: null, unit, sourceUrl: url };
}

export function sanitizeConsensus(release: MacroRelease): MacroRelease {
  const finite = (value: number | null) => typeof value === "number" && Number.isFinite(value) ? value : null;
  release = { ...release, actual:finite(release.actual), previous:finite(release.previous), revisedPrevious:finite(release.revisedPrevious), consensus:finite(release.consensus) };
  const asOf = Date.parse(release.consensusAsOf ?? ""), releaseAt = Date.parse(release.releaseAt ?? "");
  if (!Number.isFinite(asOf) || !Number.isFinite(releaseAt) || asOf >= releaseAt || release.consensus === null)
    return { ...release, consensus: null, consensusAsOf: null };
  return release;
}

/** This is an observed move in the named asset, never a macro forecast. */
export function observedPairDirection(title: string, pair: string): NewsPairEffect["direction"] {
  pair = pair.replace(/\//g, "").toUpperCase();
  if (/\b(not|never|may|might|could|would|will|expected|forecast|if|whether|miners?|shares)\b|n['’]t|\?/i.test(title)) return "uncertain";
  const names: Record<string, string> = { XAU:"(?:gold|bullion)", USD:"(?:us dollar|u\\.s\\. dollar|dollar|greenback)", EUR:"euro", GBP:"(?:pound|sterling)", JPY:"yen", CHF:"swiss franc", CAD:"canadian dollar", AUD:"australian dollar", NZD:"new zealand dollar" };
  const sign = (asset: string): number | null => {
    if (!names[asset] || asset === "USD" && /(?:australian|canadian|new zealand) dollar/i.test(title)) return null;
    const tail = new RegExp(`\\b${names[asset]}\\b([^,;:.]{0,60})`, "i").exec(title)?.[1];
    const clause = tail?.split(/\b(?:as|while|after|because|amid|following|despite|with)\b/i)[0];
    if (!clause) return null;
    const up = /\b(rises?|rose|rising|gains?|surges?|strengthens?|rall(?:y|ies|ied)|higher)\b/i.test(clause);
    const down = /\b(falls?|fell|falling|drops?|weakens?|declines?|lower)\b/i.test(clause);
    return up === down ? null : up ? 1 : -1;
  };
  const base = sign(pair.slice(0,3)), quote = sign(pair.slice(3));
  const n = base !== null && quote !== null ? base === quote ? null : base : base ?? (quote === null ? null : -quote);
  // Only explicit gold moves; a dollar move alone is a conditional transmission.
  if (pair === "XAUUSD" && base === null) return "uncertain";
  return n === null ? "uncertain" : n > 0 ? "bullish" : "bearish";
}

const prose: Record<string, [string,string]> = {
  it: ["La reazione dipende da attese, riprezzamento dei tassi e risposta del prezzo; il tema della notizia non determina da solo la direzione futura.", "Lo scenario va rivalutato se emergono revisioni, evidenze contrastanti o il prezzo non conferma la trasmissione ipotizzata."],
  en: ["The reaction depends on expectations, rate repricing and price response; the topic alone does not determine future direction.", "Reassess if revisions, conflicting evidence or an unconfirmed price response emerge."],
  es: ["La reacción depende de las expectativas, los tipos y el precio; el tema no determina por sí solo la dirección futura.", "Revisar si aparecen revisiones, datos contradictorios o falta de confirmación del precio."],
  fr: ["La réaction dépend des attentes, des taux et du prix ; le thème seul ne détermine pas la direction future.", "Réévaluer en cas de révisions, de données contradictoires ou d'absence de confirmation du prix."],
  de: ["Die Reaktion hängt von Erwartungen, Zinsen und Preisreaktion ab; das Thema allein bestimmt keine künftige Richtung.", "Bei Revisionen, widersprüchlichen Daten oder fehlender Preisbestätigung neu bewerten."],
};
export function pairEffects(article: NewsArticle, pairs: string, lang = "it"): NewsPairEffect[] {
  const selected = pairs.split(",").map(p=>p.replace(/\//g,"").trim().toUpperCase());
  const [scenario,invalidation] = prose[lang] ?? prose.en;
  return PAIR_CATALOG.filter(p=>selected.includes(p.symbol)).map(p=>({pair:p.symbol,horizonHours:4,
    direction:observedPairDirection(article.originalTitle ?? article.title,p.symbol), fact:article.originalTitle ?? article.title,
    scenario,invalidation,evidenceUrls:[article.resolvedUrl ?? article.url ?? ""].filter(Boolean)}));
}

export function identifyNewsEvidence(articles: NewsArticle[], fullTexts = new Map<string,string>(), receivedAt = new Date()) {
  return articles.map(article => {
    const { rawEvidenceText, ...publication } = article as NewsArticle & { rawEvidenceText?: string };
    const canonical = canonicalNewsUrl(article.resolvedUrl ?? article.url);
    const articleId = evidenceId(`${article.source}:${canonical ?? article.originalTitle ?? article.title}`);
    const evidenceText = fullTexts.get(article.resolvedUrl ?? article.url ?? "") ?? rawEvidenceText ?? article.originalSummary ?? article.summary;
    const release = article.release ? sanitizeConsensus(article.release) : documentedRelease(article,evidenceText);
    const eventId = release?.referencePeriod && release.releaseAt ? evidenceId(`${release.country}:${release.eventType}:${release.referencePeriod}:${release.releaseAt}`) : articleId;
    const sourceDocumentId = evidenceId(`${articleId}:${article.originalTitle ?? article.title}:${evidenceText}:${article.publishedAt ?? "unknown"}:${article.contentBasis ?? "headline"}`);
    return { ...publication, articleId, eventId, sourceDocumentId, firstSeenAt:receivedAt.toISOString(), release, evidenceText };
  });
}

export async function archiveNewsEvidence(articles: NewsArticle[], fullTexts = new Map<string,string>(), receivedAt = new Date()): Promise<NewsArticle[]> {
  if (!articles.length) return [];
  const identified = identifyNewsEvidence(articles,fullTexts,receivedAt);
  try {
    const { db,newsDocumentsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");
    if (!identified.length) return identified;
    await db.insert(newsDocumentsTable).values(identified.map(a=>({id:a.sourceDocumentId,articleId:a.articleId,eventId:a.eventId,source:a.source,
      publishedAt:a.publishedAt && Number.isFinite(Date.parse(a.publishedAt)) ? new Date(a.publishedAt) : null,
      firstSeenAt:receivedAt,evidenceText:a.evidenceText,payload:{...a,evidenceText:undefined}}))).onConflictDoNothing();
    const persisted = await db.select({id:newsDocumentsTable.id,firstSeenAt:newsDocumentsTable.firstSeenAt}).from(newsDocumentsTable).where(inArray(newsDocumentsTable.id,identified.map(a=>a.sourceDocumentId)));
    const firstSeen = new Map(persisted.map(r=>[r.id,r.firstSeenAt.toISOString()]));
    return identified.map(({evidenceText: _evidence,...a})=>({...a,firstSeenAt:firstSeen.get(a.sourceDocumentId) ?? a.firstSeenAt,archiveStatus:"persisted" as const}));
  } catch {
    return identified.map(({evidenceText: _evidence,...a})=>({...a,archiveStatus:"unavailable" as const}));
  }
}
