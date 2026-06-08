import assert from "node:assert/strict";
import { uploadBackgroundImage } from "./backgroundSettingsApi.js";

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
    const calls = mockFetch(() => Response.json({ url: "/uploads/backgrounds/desk.png" }));
    const file = new File(["image-bytes"], "desk.png", { type: "image/png" });

    const result = await uploadBackgroundImage(file, { basePath: "/" });

    assert.deepEqual(result, { url: "/uploads/backgrounds/desk.png" });
    assert.equal(calls[0]?.url, "/api/settings/background");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.headers, undefined);
    assert.equal(calls[0]?.init?.body instanceof FormData, true);
    assert.equal((calls[0]?.init?.body as FormData).get("image"), file);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("background settings api checks passed");
