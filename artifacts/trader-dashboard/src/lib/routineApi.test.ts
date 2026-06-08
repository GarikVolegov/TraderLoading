import assert from "node:assert/strict";
import {
  fetchRoutineCompetition,
  recordRoutineCompletion,
  routineCompetitionQueryKey,
} from "./routineApi.js";

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
  assert.deepEqual(routineCompetitionQueryKey, ["/api/routines/competition"]);

  {
    const calls = mockFetch(() => Response.json([{ rank: 1, name: "Ari", score: 185 }]));
    const result = await fetchRoutineCompetition({ basePath: "/" });

    assert.equal(calls[0]?.url, "/api/routines/competition");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(result[0]?.name, "Ari");
  }

  {
    const calls = mockFetch(() => Response.json({ id: 1, qualityScore: 80, completionDate: "2026-06-07" }, { status: 201 }));
    const result = await recordRoutineCompletion(
      {
        routineId: "morning",
        routineTitle: "Programma Mattutino",
        template: "morning",
        answers: { emotion: "calm" },
      },
      { basePath: "/" },
    );

    assert.equal(calls[0]?.url, "/api/routines/completions");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(result.qualityScore, 80);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("routine api checks passed");
