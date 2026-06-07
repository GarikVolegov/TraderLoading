import assert from "node:assert/strict";
import { fetchLeaderboard, leaderboardQueryKey } from "./leaderboardApi.js";

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
    assert.deepEqual(leaderboardQueryKey, ["/api/leaderboard"]);
  }

  {
    const calls = mockFetch(() =>
      Response.json([
        { position: 1, userId: "u1", name: "Ari", avatarUrl: null, level: 4, xp: 1200 },
      ]),
    );

    const result = await fetchLeaderboard({ basePath: "/" });

    assert.equal(calls[0]?.url, "/api/leaderboard");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(result[0]?.name, "Ari");
  }

  {
    mockFetch(() => new Response("", { status: 500 }));

    await assert.rejects(fetchLeaderboard({ basePath: "/" }), /500/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("leaderboard api checks passed");
