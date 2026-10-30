/**
 * AUREUS PROTOCOL — SEM, Paid Acquisition & AI Search (GEO) Attribution Engine
 *
 * Captures and persists (60-day window):
 * 1. Standard UTM parameters (utm_source, utm_medium, utm_campaign, utm_term, utm_content)
 * 2. Ad-network click identifiers (gclid, fbclid, msclkid, ttclid, twclid)
 * 3. Generative AI Search Engine referrers (ChatGPT, Perplexity, Claude, Gemini, Copilot, Grok, You.com, Phind, Meta AI)
 * 4. Organic Search, Social, Referral & Direct classification
 */

export const SEM_ATTRIBUTION_STORAGE_KEY = "aureus_sem_attribution_v1";
export const SEM_ATTRIBUTION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export type SemChannel =
  | "ai_search"
  | "paid_sem"
  | "organic_search"
  | "social"
  | "referral"
  | "direct";

export type AiEngineId =
  | "chatgpt"
  | "perplexity"
  | "claude"
  | "gemini"
  | "copilot"
  | "grok"
  | "you"
  | "phind"
  | "meta_ai";

export interface SemAttributionRecord {
  channel: SemChannel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  ttclid: string | null;
  twclid: string | null;
  referrerHost: string | null;
  aiEngine: AiEngineId | null;
  landingPath: string;
  capturedAt: number;
  expiresAt: number;
}

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "paid_search",
  "paidsocial",
  "paid_social",
  "display",
  "cpm",
  "retargeting",
]);

const AI_ENGINE_MATCHERS: ReadonlyArray<{
  id: AiEngineId;
  hostPatterns: readonly RegExp[];
  sourcePatterns: readonly RegExp[];
}> = [
  {
    id: "chatgpt",
    hostPatterns: [/(^|\.)chatgpt\.com$/i, /(^|\.)openai\.com$/i],
    sourcePatterns: [/^chatgpt(\.com)?$/i, /^openai$/i, /^gptsearch$/i],
  },
  {
    id: "perplexity",
    hostPatterns: [/(^|\.)perplexity\.ai$/i],
    sourcePatterns: [/^perplexity(\.ai)?$/i],
  },
  {
    id: "claude",
    hostPatterns: [/(^|\.)claude\.ai$/i, /(^|\.)anthropic\.com$/i],
    sourcePatterns: [/^claude(\.ai)?$/i, /^anthropic$/i],
  },
  {
    id: "gemini",
    hostPatterns: [/^gemini\.google\.com$/i, /^bard\.google\.com$/i],
    sourcePatterns: [/^gemini$/i, /^google_gemini$/i],
  },
  {
    id: "copilot",
    hostPatterns: [/^copilot\.microsoft\.com$/i],
    sourcePatterns: [/^copilot$/i, /^bing_copilot$/i],
  },
  {
    id: "grok",
    hostPatterns: [/(^|\.)grok\.com$/i, /(^|\.)x\.ai$/i],
    sourcePatterns: [/^grok$/i, /^xai$/i],
  },
  {
    id: "you",
    hostPatterns: [/(^|\.)you\.com$/i],
    sourcePatterns: [/^you(\.com)?$/i],
  },
  {
    id: "phind",
    hostPatterns: [/(^|\.)phind\.com$/i],
    sourcePatterns: [/^phind(\.com)?$/i],
  },
  {
    id: "meta_ai",
    hostPatterns: [/(^|\.)meta\.ai$/i],
    sourcePatterns: [/^meta_ai$/i, /^meta\.ai$/i],
  },
];

const ORGANIC_SEARCH_HOST_PATTERNS: readonly RegExp[] = [
  /(^|\.)google\.[a-z.]+$/i,
  /(^|\.)bing\.com$/i,
  /(^|\.)duckduckgo\.com$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)ecosia\.org$/i,
  /(^|\.)search\.brave\.com$/i,
  /(^|\.)yandex\.[a-z.]+$/i,
  /(^|\.)baidu\.com$/i,
  /(^|\.)qwant\.com$/i,
];

const SOCIAL_HOST_PATTERNS: readonly RegExp[] = [
  /(^|\.)t\.co$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)telegram\.org$/i,
  /(^|\.)discord\.com$/i,
  /(^|\.)discord\.gg$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)tiktok\.com$/i,
];

const INTERNAL_HOST_PATTERNS: readonly RegExp[] = [
  /(^|\.)aureus-os\.app$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
];

function cleanParam(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 180);
  return trimmed.length > 0 ? trimmed : null;
}

export function extractReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const parsed = new URL(referrer);
    const host = parsed.hostname.toLowerCase();
    if (!host) return null;
    if (INTERNAL_HOST_PATTERNS.some((re) => re.test(host))) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function detectAiEngine(
  referrerHost: string | null,
  utmSource: string | null,
): AiEngineId | null {
  for (const matcher of AI_ENGINE_MATCHERS) {
    if (referrerHost && matcher.hostPatterns.some((re) => re.test(referrerHost))) {
      return matcher.id;
    }
    if (utmSource && matcher.sourcePatterns.some((re) => re.test(utmSource))) {
      return matcher.id;
    }
  }
  return null;
}

export function classifyTrafficSource(input: {
  search: string | URLSearchParams;
  referrer?: string | null;
  landingPath?: string;
  now?: number;
}): SemAttributionRecord {
  const params =
    typeof input.search === "string"
      ? new URLSearchParams(input.search)
      : input.search;

  const utmSource = cleanParam(params.get("utm_source"));
  const utmMedium = cleanParam(params.get("utm_medium"));
  const utmCampaign = cleanParam(params.get("utm_campaign"));
  const utmTerm = cleanParam(params.get("utm_term"));
  const utmContent = cleanParam(params.get("utm_content"));

  const gclid = cleanParam(params.get("gclid"));
  const fbclid = cleanParam(params.get("fbclid"));
  const msclkid = cleanParam(params.get("msclkid"));
  const ttclid = cleanParam(params.get("ttclid"));
  const twclid = cleanParam(params.get("twclid"));

  const referrerHost = extractReferrerHost(input.referrer);
  const aiEngine = detectAiEngine(referrerHost, utmSource);

  const hasClickId = Boolean(gclid || fbclid || msclkid || ttclid || twclid);
  const normalizedMedium = utmMedium?.toLowerCase() ?? "";

  let channel: SemChannel = "direct";

  if (hasClickId || PAID_MEDIUMS.has(normalizedMedium)) {
    channel = "paid_sem";
  } else if (aiEngine !== null) {
    channel = "ai_search";
  } else if (
    normalizedMedium === "organic" ||
    (referrerHost !== null &&
      ORGANIC_SEARCH_HOST_PATTERNS.some((re) => re.test(referrerHost)))
  ) {
    channel = "organic_search";
  } else if (
    normalizedMedium === "social" ||
    (referrerHost !== null &&
      SOCIAL_HOST_PATTERNS.some((re) => re.test(referrerHost)))
  ) {
    channel = "social";
  } else if (referrerHost !== null || utmSource !== null) {
    channel = "referral";
  }

  const now = input.now ?? Date.now();
  return {
    channel,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    gclid,
    fbclid,
    msclkid,
    ttclid,
    twclid,
    referrerHost,
    aiEngine,
    landingPath: input.landingPath || "/",
    capturedAt: now,
    expiresAt: now + SEM_ATTRIBUTION_TTL_MS,
  };
}

/**
 * Captures SEM / AI Search / Organic attribution from current browser location
 * and persists it in localStorage for 60 days.
 * Non-direct signals overwrite an existing direct record or expired record,
 * while a direct reload never overwrites an active non-direct attribution.
 */
export function captureSemAttribution(): SemAttributionRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const incoming = classifyTrafficSource({
      search: window.location.search,
      referrer: typeof document !== "undefined" ? document.referrer : null,
      landingPath: window.location.pathname || "/",
    });

    const existing = getStoredSemAttribution();
    const hasExplicitIncomingSignal =
      incoming.channel !== "direct" ||
      incoming.utmSource !== null ||
      incoming.utmCampaign !== null;

    if (!hasExplicitIncomingSignal && existing) {
      return existing;
    }

    window.localStorage.setItem(
      SEM_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify(incoming),
    );

    if (incoming.channel !== "direct") {
      void syncSemAttributionToServer(incoming);
    }

    return incoming;
  } catch {
    return null;
  }
}

/**
 * Syncs the attribution record to the backend /api/sem/record endpoint once per session.
 */
export async function syncSemAttributionToServer(
  record?: SemAttributionRecord | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  const target = record ?? getStoredSemAttribution();
  if (!target || target.channel === "direct") return;

  const syncKey = `aureus_sem_synced_${target.capturedAt}`;
  try {
    if (window.sessionStorage.getItem(syncKey)) return;
  } catch {
    // SessionStorage disabled
  }

  try {
    const res = await fetch("/api/sem/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    if (res.ok) {
      try {
        window.sessionStorage.setItem(syncKey, "1");
      } catch {
        // Ignore storage errors
      }
    }
  } catch {
    // Fail-soft in background
  }
}

/**
 * Returns the active (non-expired) SEM/AI Search attribution record, or null.
 */
export function getStoredSemAttribution(): SemAttributionRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SEM_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SemAttributionRecord;
    if (!parsed || typeof parsed.expiresAt !== "number") {
      window.localStorage.removeItem(SEM_ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(SEM_ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
