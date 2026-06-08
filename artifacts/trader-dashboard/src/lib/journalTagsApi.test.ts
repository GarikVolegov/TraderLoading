import assert from "node:assert/strict";
import { fetchJournalTags, journalTagsQueryKey, saveJournalTag } from "./journalTagsApi.js";

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
    assert.deepEqual(journalTagsQueryKey, ["journal-tags"]);
  }

  {
    const calls = mockFetch(() => Response.json([{ tag: "breakout", count: 3 }]));

    const tags = await fetchJournalTags({ basePath: "/trader/" });

    assert.equal(calls[0]?.url, "/trader/api/journal/tags");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.deepEqual(tags, [{ tag: "breakout", count: 3 }]);
  }

  {
    mockFetch(() => Response.json([{ tag: "London", count: 0 }]));

    assert.deepEqual(await fetchJournalTags({ basePath: "/" }), [{ tag: "London", count: 0 }]);
  }

  {
    const calls = mockFetch(() => Response.json({ tag: "London", count: 0 }));

    const tag = await saveJournalTag("London", { basePath: "/trader/" });

    assert.equal(calls[0]?.url, "/trader/api/journal/tags");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ tag: "London" }));
    assert.deepEqual(tag, { tag: "London", count: 0 });
  }

  {
    mockFetch(() => new Response("", { status: 500 }));

    assert.deepEqual(await fetchJournalTags({ basePath: "/" }), []);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("journal tags api checks passed");
