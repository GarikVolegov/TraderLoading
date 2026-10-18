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
    const calls = mockFetch(() => Response.json({ saved: true }));
    await apiJSON("library/contents", { method: "POST", body: JSON.stringify({ title: "Note" }), headers: { Authorization: "synthetic-token" } }, { basePath: "/" });
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get("Authorization"), "synthetic-token");
    assert.equal(calls[0]?.init?.body, '{"title":"Note"}');
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls = mockFetch(() => Response.json({ saved: true }));
    await apiJSON("custom", { method: "POST", body: "text", headers: [["content-type", "text/plain"]] }, { basePath: "/" });
    assert.equal(new Headers(calls[0]?.init?.headers).get("Content-Type"), "text/plain");
    const form = new FormData();
    await apiJSON("upload", { method: "POST", body: form }, { basePath: "/" });
    assert.equal(new Headers(calls[1]?.init?.headers).has("Content-Type"), false);
    assert.equal(calls[1]?.init?.body, form);
    await apiJSON("read", undefined, { basePath: "/" });
    assert.equal(new Headers(calls[2]?.init?.headers).has("Content-Type"), false);
  }

  {
    mockFetch(() => new Response("", { status: 404 }));

    await assert.rejects(apiJSON("missing", undefined, { basePath: "/" }), /404/);
  }

  {
    for (const status of [204, 205]) {
      mockFetch(() => new Response(null, { status }));
      assert.equal(await apiJSON<void>("process/method-draft", { method: "PUT" }), undefined);
    }
  }

  // Finding 2.8: apiJSON discarded the {error} body and threw just the status code,
  // so off-contract callers (tornei/admin/community) showed "400" instead of the
  // real server message. It must surface {error} like apiFetch/apiUpload.
  {
    mockFetch(() => Response.json({ error: "Already joined this season" }, { status: 400 }));
    await assert.rejects(apiJSON("tornei/join", undefined, { basePath: "/" }), /Already joined this season/);
  }

  // A non-ok body without a usable `error` falls back to HTTP <status>.
  {
    mockFetch(() => Response.json({ message: "nope" }, { status: 500 }));
    await assert.rejects(apiJSON("x", undefined, { basePath: "/" }), /HTTP 500/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("api fetch checks passed");
