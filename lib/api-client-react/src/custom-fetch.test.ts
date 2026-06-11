import { customFetch } from "./custom-fetch.js";

const originalFetch = globalThis.fetch;

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

try {
  {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await customFetch("/api/settings", { responseType: "json" });

    assertEqual(calls[0]?.init?.credentials, "include");
  }

  {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await customFetch("/api/public", {
      responseType: "json",
      credentials: "omit",
    });

    assertEqual(calls[0]?.init?.credentials, "omit");
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("custom fetch credential defaults passed");
