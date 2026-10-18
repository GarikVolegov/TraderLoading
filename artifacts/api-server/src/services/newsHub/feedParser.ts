import { cleanNewsText } from "./contentQuality.js";
import { OFFICIAL_NEWS_FEEDS, officialArticleUrl } from "./officialSources.js";
import type { NewsArticle } from "./types.js";

import { NEWS_FEED_MAX_BYTES } from "./responseBody.js";
export { readBoundedNewsResponse, NEWS_FEED_MAX_BYTES } from "./responseBody.js";

function decode(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ").replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity =>
      ({ "&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":'"', "&apos;":"'", "&nbsp;":" " })[entity] ?? entity)
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const n = code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : Number(code);
      return n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "�";
    }).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  return new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i").exec(block)?.[1] ?? "";
}
function date(value: string): string | null {
  const parsed = Date.parse(decode(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
function link(value: string, baseUrl?: string): string | null {
  try {
    const url = new URL(decode(value), baseUrl);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

/** RSS 2.0, RSS 1.0/RDF and Atom. Missing publication time remains null. */
export function parseNewsFeed(xml: string, sourceName: string, baseUrl?: string): NewsArticle[] {
  if (Buffer.byteLength(xml) > NEWS_FEED_MAX_BYTES) throw new Error("News feed exceeds size limit");
  if (!/<(?:rss|rdf:RDF|feed)\b/i.test(xml)) throw new Error("Received content other than a supported news feed");
  const official = OFFICIAL_NEWS_FEEDS.some(feed => feed.source === sourceName);
  const articles: NewsArticle[] = [];
  for (const match of xml.matchAll(/<(item|entry)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const [, kind, attributes, block] = match;
    const title = decode(tag(block, "title"));
    if (title.length < 5) continue;
    const sourceTag = /<source\b[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i.exec(block);
    const source = sourceTag ? decode(sourceTag[2]) || sourceName : sourceName;
    const description = tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || tag(block, "content");
    const summary = cleanNewsText(decode(description).slice(0, 900) || title, source);
    const atomLinks = [...block.matchAll(/<link\b([^>]*)\/?\s*>/gi)].map(entry => entry[1]);
    const atomLink = atomLinks.find(attrs => !/\brel=["'](?:self|enclosure)["']/i.test(attrs));
    const atomHref = atomLink?.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const rawUrl = kind.toLowerCase() === "entry" ? atomHref || tag(block, "id") :
      tag(block, "link") || tag(block, "guid") || attributes.match(/rdf:about=["']([^"']+)["']/i)?.[1];
    let url = link(rawUrl ?? "", baseUrl);
    // Some official feeds (BoJ) still publish HTTP links. Only upgrade when the
    // corresponding HTTPS URL passes the exact official domain/path allowlist.
    if (official && url?.startsWith("http:")) url = officialArticleUrl(url.replace(/^http:/, "https:")) ?? url;
    // Atom updated is a revision timestamp, not a substitute for publication.
    const publishedAt = date(tag(block, "pubDate") || tag(block, "dc:date") || tag(block, "published"));
    const image = /<(?:media:thumbnail|media:content|enclosure)\b[^>]*url=["']([^"']+)["'][^>]*>/i.exec(block)?.[1];
    articles.push({ title, summary, source, publishedAt, url,
      sourceUrl: sourceTag ? link(sourceTag[1]) : null,
      sourceType: official && officialArticleUrl(url) ? "official" : "publisher",
      analysisMethod:"none", contentBasis:summary === title ? "headline" : "snippet",
      sentiment:null, imageUrl:image && /(?:\.(?:png|jpe?g|webp|gif)(?:\?|$)|image\/)/i.test(image) ? link(image, baseUrl) : null });
  }
  return articles;
}
