import assert from "node:assert/strict";
import { refreshEconomicCalendar } from "./calendarApi.js";

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
    const calls = mockFetch(() => Response.json([]));

    await refreshEconomicCalendar({ basePath: "/" });

    assert.equal(calls[0]?.url, "/api/calendar?nocache=1");
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls = mockFetch(() => Response.json([]));

    await refreshEconomicCalendar({ basePath: "/trader/" });

    assert.equal(calls[0]?.url, "/trader/api/calendar?nocache=1");
  }

  {
    mockFetch(() => new Response("", { status: 502 }));

    await assert.rejects(refreshEconomicCalendar({ basePath: "/" }), /Failed to refresh economic calendar: 502/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("calendar api checks passed");
