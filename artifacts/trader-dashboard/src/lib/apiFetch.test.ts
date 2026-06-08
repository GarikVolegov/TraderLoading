import assert from "node:assert/strict";
import { apiFetch, apiJSON, apiRequest, apiUpload, createApiUrl } from "./apiFetch.js";

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
    const calls = mockFetch(() => Response.json({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>("/api/example", { method: "POST", body: JSON.stringify({ a: 1 }) });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls[0]?.url, "/api/example");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "application/json" });
  }

  {
    mockFetch(() => Response.json({ error: "Invalid input" }, { status: 400 }));

    await assert.rejects(apiFetch("/api/fail"), /Invalid input/);
  }

  {
    mockFetch(() => new Response("nope", { status: 503, statusText: "Service Unavailable" }));

    await assert.rejects(apiFetch("/api/fail-text"), /Service Unavailable/);
  }

  {
    const calls = mockFetch(() => Response.json({ uploaded: true }));
    const form = new FormData();
    form.set("file", new Blob(["data"]), "sample.txt");

    const result = await apiUpload<{ uploaded: boolean }>("/api/upload", form);

    assert.deepEqual(result, { uploaded: true });
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.body, form);
    assert.equal(calls[0]?.init?.headers, undefined);
  }

  {
    assert.equal(createApiUrl("social/upload-image", "/"), "/api/social/upload-image");
    assert.equal(createApiUrl("/social/upload-image", "/trader/"), "/trader/api/social/upload-image");
    assert.equal(createApiUrl("milestones/3/files", ""), "/api/milestones/3/files");
    assert.equal(createApiUrl("api/social/profile/user-1", "/"), "/api/social/profile/user-1");
  }

  {
    const calls = mockFetch(() => Response.json({ received: true }));
    const form = new FormData();

    const response = await apiRequest("social/upload-image", { method: "POST", body: form }, { basePath: "/trader/" });

    assert.equal(response.ok, true);
    assert.equal(calls[0]?.url, "/trader/api/social/upload-image");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.body, form);
    assert.equal(calls[0]?.init?.headers, undefined);
  }

  {
    mockFetch(() => Response.json({ rows: [1, 2, 3] }));

    assert.deepEqual(await apiJSON<{ rows: number[] }>("community/files", undefined, { basePath: "/" }), {
      rows: [1, 2, 3],
    });
  }

  {
    mockFetch(() => new Response("", { status: 404 }));

    await assert.rejects(apiJSON("missing", undefined, { basePath: "/" }), /404/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("api fetch checks passed");
