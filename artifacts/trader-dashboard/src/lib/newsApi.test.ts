import assert from "node:assert/strict";
import { fetchNews, createNewsQueryKey, createNewsSubscribeMessage, createNewsRefreshMessage } from "./newsApi.js";

const originalFetch = globalThis.fetch;

type FetchCall = {
  url: RequestInfo | URL;
  init: RequestInit | undefined;
};

function mockFetch(handler: (url: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

try {
  {
    assert.deepEqual(createNewsQueryKey("EURUSD,XAUUSD", "it"), ["macro-news", "EURUSD,XAUUSD", "it"]);
    assert.deepEqual(createNewsSubscribeMessage("EURUSD,XAUUSD", "it"), {
      type: "subscribe",
      pairs: "EURUSD,XAUUSD",
      lang: "it",
    });
    assert.deepEqual(createNewsRefreshMessage("EURUSD,XAUUSD", "it"), {
      type: "refresh",
      pairs: "EURUSD,XAUUSD",
      lang: "it",
      force: true,
    });
  }

  {
    const calls = mockFetch(() =>
      Response.json({
        articles: [{ title: "ECB update", summary: "Rates", source: "reuters", sentiment: "neutral" }],
        fetchedAt: "2026-06-07T10:00:00.000Z",
        hasApiKey: true,
      }),
    );

    const result = await fetchNews({ selectedPairsKey: "EUR/USD,XAU/USD", language: "it", basePath: "/" });

    assert.equal(calls[0]?.url, "/api/news?_=1&pairs=EUR%2FUSD%2CXAU%2FUSD&lang=it");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(result.articles[0]?.title, "ECB update");
  }

  {
    const calls = mockFetch(() =>
      Response.json({
        articles: [],
        fetchedAt: "2026-06-07T10:00:00.000Z",
        hasApiKey: false,
      }),
    );

    await fetchNews({ selectedPairsKey: "", language: "en", noCache: true, basePath: "/trader/" });

    assert.equal(calls[0]?.url, "/trader/api/news?nocache=1&lang=en");
  }

  {
    const calls = mockFetch(() =>
      Response.json({
        articles: [],
        fetchedAt: "2026-06-07T10:00:00.000Z",
        hasApiKey: true,
        nextCursor: "30",
        totalCount: 80,
      }),
    );

    const result = await fetchNews({ selectedPairsKey: "XAUUSD", language: "it", cursor: "15", limit: 15, basePath: "/" });

    assert.equal(calls[0]?.url, "/api/news?_=1&pairs=XAUUSD&lang=it&cursor=15&limit=15");
    assert.equal(result.nextCursor, "30");
    assert.equal(result.totalCount, 80);
  }

  {
    mockFetch(() => new Response("", { status: 503 }));

    await assert.rejects(fetchNews({ selectedPairsKey: "", language: "en", basePath: "/" }), /Failed to fetch news/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("news api checks passed");
