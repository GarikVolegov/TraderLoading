import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface ForexFactoryEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string | null;
  previous: string | null;
}

// ─── Cache (4 ore — evita rate-limit di Forex Factory) ────────────────────────
let cache: { data: CalendarEvent[]; ts: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 ore

// URL mirror pubblico (alternativa diretta a Forex Factory)
const FF_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json",
];

async function fetchFromUrl(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.forexfactory.com/",
      "Origin": "https://www.forexfactory.com",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  let raw: ForexFactoryEvent[];
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Response is not valid JSON");
  }

  if (!Array.isArray(raw)) throw new Error("Unexpected response format");

  return raw
    .filter((e) => ["High", "Medium", "Low", "Holiday"].includes(e.impact))
    .map((e) => ({
      title: e.title,
      country: e.country,
      date: e.date,
      impact: e.impact as CalendarEvent["impact"],
      forecast: e.forecast || null,
      previous: e.previous || null,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  for (const url of FF_URLS) {
    try {
      return await fetchFromUrl(url);
    } catch (err) {
      console.warn(`[calendar] ${url} →`, err instanceof Error ? err.message : err);
    }
  }
  throw new Error("Tutti gli URL del calendario hanno fallito");
}

// ─── Calendario statico di fallback (eventi noti di questa settimana) ─────────
function buildFallback(): CalendarEvent[] {
  // Ritorna array vuoto — il frontend mostra un messaggio apposito
  return [];
}

router.get("/calendar", async (_req, res) => {
  const noCache = _req.query.nocache === "1";

  if (!noCache && cache && Date.now() - cache.ts < CACHE_TTL) {
    res.json(cache.data);
    return;
  }

  try {
    const events = await fetchCalendarEvents();
    cache = { data: events, ts: Date.now() };
    res.json(events);
  } catch (err) {
    console.error("[calendar] fetch error:", err instanceof Error ? err.message : err);

    // Ritorna la cache stale se disponibile, altrimenti fallback vuoto
    if (cache) {
      res.json(cache.data);
      return;
    }

    const fallback = buildFallback();
    res.json(fallback);
  }
});

export default router;
