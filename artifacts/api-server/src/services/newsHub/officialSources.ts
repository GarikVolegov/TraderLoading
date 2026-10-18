import type { NewsArticle } from "./types.js";
import { readBoundedNewsResponse } from "./responseBody.js";

export const OFFICIAL_NEWS_FEEDS = [
  { url: "https://www.federalreserve.gov/feeds/press_monetary.xml", source: "Federal Reserve" },
  { url: "https://www.federalreserve.gov/feeds/speeches_and_testimony.xml", source: "Federal Reserve" },
  { url: "https://www.ecb.europa.eu/rss/press.html", source: "ECB" },
  { url: "https://www.ecb.europa.eu/rss/statpress.html", source: "ECB" },
  { url: "https://www.bankofengland.co.uk/rss/news", source: "Bank of England" },
  { url: "https://www.bankofengland.co.uk/rss/speeches", source: "Bank of England" },
  { url: "https://www.boj.or.jp/en/rss/whatsnew.xml", source: "Bank of Japan" },
  { url: "https://www.snb.ch/public/rss/en/mopo", source: "SNB" },
  { url: "https://www.bankofcanada.ca/content_type/press-releases/feed/", source: "Bank of Canada" },
  { url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", source: "RBA" },
  { url: "https://www.bls.gov/feed/cpi.rss", source: "BLS" },
  { url: "https://www.bls.gov/feed/empsit.rss", source: "BLS" },
  { url: "https://apps.bea.gov/rss/rss.xml", source: "BEA" },
] as const;

/** Only source articles on these exact official domains are fetched for full text. */
export function officialArticleUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    const allowed = (url.hostname === "www.federalreserve.gov" && /^\/newsevents\/(pressreleases|speech|testimony)\//.test(url.pathname)) ||
      (url.hostname === "www.ecb.europa.eu" && url.pathname.startsWith("/press/")) ||
      (url.hostname === "www.bankofengland.co.uk" && /^\/(news|speech|monetary-policy-summary-and-minutes)\//.test(url.pathname)) ||
      (url.hostname === "www.boj.or.jp" && /^\/en\/(mopo|about\/press|announcements)\//.test(url.pathname)) ||
      (url.hostname === "www.snb.ch" && /^\/(en\/(publications|ifor)|public\/asset)\//.test(url.pathname)) ||
      (url.hostname === "www.bankofcanada.ca" && /^\/20\d{2}\/\d{2}\//.test(url.pathname)) ||
      (url.hostname === "www.rba.gov.au" && /^\/(media-releases|speeches|publications)\//.test(url.pathname)) ||
      (url.hostname === "www.rbnz.govt.nz" && /^\/(monetary-policy|hub|news-and-events)\//.test(url.pathname)) ||
      (url.hostname === "www.bls.gov" && url.pathname.startsWith("/news.release/")) ||
      (url.hostname === "www.bea.gov" && url.pathname.startsWith("/news/"));
    if (!allowed) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function decodeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : "�";
}

function plainText(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|h[1-6]|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, e => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[e] ?? e)
    .replace(/&#(\d+);/g, (_, n: string) => decodeCodePoint(Number(n)))
    .replace(/&#x([a-f\d]+);/gi, (_, n: string) => decodeCodePoint(parseInt(n, 16)))
    .replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Balanced source-specific container extraction, rather than summarizing menus/footer. */
export function extractOfficialArticleText(html: string, rawUrl: string): string | null {
  const url = officialArticleUrl(rawUrl);
  if (!url) return null;
  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const host = new URL(url).hostname;
  const fed = host === "www.federalreserve.gov";
  const open = fed ? /<div\b[^>]*\bid=["']article["'][^>]*>/i.exec(html) :
    host === "www.bls.gov" ? /<div\b[^>]*\bid=["'](?:bodytext|news-release)["'][^>]*>/i.exec(html) ?? /<pre\b[^>]*>/i.exec(html) :
    /<article\b[^>]*>/i.exec(html) ?? /<main\b[^>]*>/i.exec(html);
  if (!open) return null;
  const tag = /^<(\w+)/i.exec(open[0])![1];
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tokens.lastIndex = open.index + open[0].length;
  const begin = tokens.lastIndex;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      const content = html.slice(begin, match.index).replace(/<(?:nav|footer|aside)\b[\s\S]*?<\/(?:nav|footer|aside)>/gi, "");
      const text = plainText(content).split(/\n(?:CONTACT|Annexes|Related topics|Last Update:|For media inquiries,|Reproduction is permitted)/i)[0].trim();
      return text.length >= 120 ? text.slice(0, 40_000) : null;
    }
  }
  return null;
}

export function officialSourceExcerpt(text: string, title: string): string {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length >= 70 && p.toLowerCase() !== title.toLowerCase());
  const body = paragraphs.slice(0, 3).join(" ");
  if (body.length <= 900) return body;
  const boundary = body.slice(0, 900).lastIndexOf(". ");
  return boundary >= 200 ? body.slice(0, boundary + 1) : `${body.slice(0, 897).trimEnd()}…`;
}

type Fetcher = typeof fetch;
export async function fetchOfficialArticleText(rawUrl: string, fetcher: Fetcher = fetch): Promise<string | null> {
  let url = officialArticleUrl(rawUrl);
  if (!url) return null;
  try {
    for (let redirect = 0; redirect < 4; redirect++) {
      const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "TraderLoading/1.0", Accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        url = location ? officialArticleUrl(new URL(location, url).toString()) : null;
        if (!url) return null;
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !response.body) return null;
      return extractOfficialArticleText(await readBoundedNewsResponse(response), url);
    }
  } catch { /* A failed extraction leaves the genuine feed headline available. */ }
  return null;
}

const textCache = new Map<string, { text: string | null; expires: number }>();
const pending = new Map<string, Promise<string | null>>();
async function cachedText(url: string): Promise<string | null> {
  const cached = textCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.text;
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const request = fetchOfficialArticleText(url).then(text => {
    if (textCache.size >= 200) textCache.delete(textCache.keys().next().value!);
    textCache.set(url, { text, expires: Date.now() + (text ? 6 * 60 * 60_000 : 5 * 60_000) });
    return text;
  }).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}

export async function enrichOfficialSources<T extends NewsArticle>(articles: T[], windowHours: number, now = Date.now()): Promise<{ articles: T[]; fullTexts: Map<string, string> }> {
  const fullTexts = new Map<string, string>();
  const candidates = articles.filter(a => a.sourceType === "official" && a.publishedAt && now - Date.parse(a.publishedAt) <= windowHours * 3_600_000 && now >= Date.parse(a.publishedAt))
    .slice(0, 12);
  const eligible = new Set(candidates.map(a => a.url));
  const enriched = await Promise.all(articles.map(async article => {
    const url = officialArticleUrl(article.url);
    if (!url || article.sourceType !== "official" || !eligible.has(article.url)) return article;
    const text = await cachedText(url);
    if (!text) return article;
    fullTexts.set(url, text);
    const summary = officialSourceExcerpt(text, article.title) || article.summary;
    return { ...article, url, resolvedUrl: url, summary, originalSummary: summary, contentBasis: "full_text" as const, citationUrls: [url] };
  }));
  return { articles: enriched, fullTexts };
}

/** NZ provides a canonical OCR page rather than a dependable RSS endpoint. */
export async function fetchRbnzPolicyArticle(fetcher: typeof fetch = fetch): Promise<(NewsArticle & { rawEvidenceText:string })[]> {
  const url = "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate";
  const response = await fetcher(url,{redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new Error(`RBNZ HTTP ${response.status}`);
  const html = await readBoundedNewsResponse(response);
  const text = extractOfficialArticleText(html,url);
  if(!text) throw new Error("RBNZ policy evidence unavailable");
  const stamp = /["']datePublished["']\s*:\s*["']([^"']+)["']/.exec(html)?.[1];
  const publishedAt = stamp && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(stamp) && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toISOString() : null;
  return [{title:"Reserve Bank of New Zealand official cash rate publication",summary:officialSourceExcerpt(text,""),rawEvidenceText:text,source:"RBNZ",publishedAt,url,sentiment:null,imageUrl:null,sourceType:"official",contentBasis:"full_text",analysisMethod:"none"}];
}
